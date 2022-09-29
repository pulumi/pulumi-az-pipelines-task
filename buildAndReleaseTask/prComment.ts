// Copyright 2016-2022, Pulumi Corporation.  All rights reserved.

import { readFileSync } from "fs";
import { join as pathJoin } from "path";

import * as azdev from "azure-devops-node-api";

import * as tl from "azure-pipelines-task-lib/task";

import { IGitApi } from "azure-devops-node-api/GitApi";
import {
    Comment,
    CommentThread,
    CommentThreadStatus,
    CommentType,
} from "azure-devops-node-api/interfaces/GitInterfaces";

import type { TaskConfig } from "models";

export const PULUMI_LOG_FILENAME = "pulumi-out.log";

/**
 * The thread's source value will always be Pulumi.
 */
const SOURCE_PULUMI = "Pulumi";

/**
 * The default metadata attached to every thread
 * created by this task. It's used to lookup
 * existing thread(s) that may have been created
 * by this task.
 */
const defaultCommentThreadProperties = {
    source: SOURCE_PULUMI,
};

function getFormattedPulumiLogs(
    pulumiLogs: string,
    pulCommand: string,
    pulStackFqdn: string
): string {
    const heading = `#### :tropical_drink: \`${pulCommand}\` on ${pulStackFqdn}`;
    const summary = "<summary>Pulumi report</summary>";
    const body = `
${heading}
<details>
${summary}

\`\`\`
${pulumiLogs}
\`\`\`

</details>
`;

    return body;
}

interface BuildEnvInfo {
    prId: number;
}

interface AzureGitRepoInfo {
    systemAccessToken: string;
    collectionUri: string;
    projectId: string;
    repositoryId: string;
}

function getLastCommentInThread(thread: CommentThread): Comment | undefined {
    if (!thread.comments?.length) {
        return;
    }

    const numComments = thread.comments.length;
    return thread.comments[numComments - 1];
}

/**
 * Creates a PR comment thread if the current build is a PR build.
 */
export async function createPrComment(taskConfig: TaskConfig) {
    // This function depends on various predefined variables found in
    // a typical Azure build pipeline.
    // See https://docs.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml.

    const shouldCreatePrComment = tl.getBoolInput("createPrComment");
    if (!shouldCreatePrComment) {
        return;
    }

    const hostType = tl.getVariable("System.HostType");
    if (hostType?.toLowerCase() !== "build") {
        tl.warning(tl.loc("Warning_NotABuildPipeline", hostType));
        return;
    }

    const repoProvider = tl.getVariable("Build.Repository.Provider");
    if (repoProvider !== "TfsGit") {
        tl.warning(tl.loc("Warning_UnSupportedRepositoryType", repoProvider));
        return;
    }

    // We shouldn't even get to this point if the
    // command or the stack were not provided.
    const pulCommand = taskConfig.command;
    const pulStackFqdn = taskConfig.stack;
    if (!pulCommand || !pulStackFqdn) {
        return;
    }

    const accessToken = tl.getVariable("System.AccessToken");
    if (!accessToken) {
        throw new Error(
            "Job access token is required to create/update PR comment"
        );
    }

    const collectionUri = tl.getVariable("System.CollectionUri");
    if (!collectionUri) {
        throw new Error("Could not determine the DevOps org's base URI");
    }

    const projectId = tl.getVariable("System.TeamProjectId");
    if (!projectId) {
        throw new Error("Could not determine the project ID");
    }

    const repositoryId = tl.getVariable("Build.Repository.ID");
    if (!repositoryId) {
        throw new Error("Could not determine the repository ID");
    }

    const prId = tl.getVariable("System.PullRequest.PullRequestId");
    if (!prId) {
        throw new Error("Could not determine the PR ID");
    }

    const buildEnvInfo: BuildEnvInfo = {
        prId: parseInt(prId, 10),
    };
    const azureRepoInfo: AzureGitRepoInfo = {
        collectionUri,
        projectId,
        repositoryId,
        systemAccessToken: accessToken,
    };

    const authHandler = azdev.getBearerHandler(accessToken);
    const webApi = new azdev.WebApi(collectionUri, authHandler);
    const gitApi = await webApi.getGitApi();

    const pulumiLogs = readFileSync(pathJoin(".", PULUMI_LOG_FILENAME), {
        encoding: "utf-8",
    });

    const commentBody = getFormattedPulumiLogs(
        pulumiLogs,
        pulCommand,
        pulStackFqdn!
    );

    const useThreads = taskConfig.useThreadedPrComments;
    if (useThreads) {
        const updated = await updateExistingThread(
            buildEnvInfo,
            azureRepoInfo,
            gitApi,
            commentBody
        );
        if (updated) {
            return;
        }
    }

    await createThread(buildEnvInfo, azureRepoInfo, gitApi, commentBody);
}

/**
 * Returns `true` if the thread was found and updated. `false` otherwise.
 */
async function updateExistingThread(
    buildEnvInfo: BuildEnvInfo,
    azureRepoInfo: AzureGitRepoInfo,
    gitApi: IGitApi,
    content: string
): Promise<boolean> {
    const threads = await gitApi.getThreads(
        azureRepoInfo.repositoryId,
        buildEnvInfo.prId,
        azureRepoInfo.projectId
    );
    tl.debug(JSON.stringify(threads));

    const pulumiCommentThreads = threads.filter(
        (t) =>
            t.status === CommentThreadStatus.Active &&
            t.properties["source"]["$value"] === SOURCE_PULUMI
    );
    // If we found a previous thread, add a comment to it.
    if (pulumiCommentThreads?.length > 0) {
        // Sort the threads in descending order of their published date,
        // so that we can add a comment to the latest one.
        // This isn't really necessary since there is likely ever going to be
        // a single thread started by this task that matches the above criteria.
        // But it's useful when testing the task in a dev build.
        pulumiCommentThreads.sort(
            (a, b) => b.publishedDate!.getTime() - a.publishedDate!.getTime()
        );

        tl.debug(tl.loc("Debug_ThreadFound"));

        await gitApi.createComment(
            {
                commentType: CommentType.System,
                content,
                // Use the last comment in the thread as the parent id.
                parentCommentId: getLastCommentInThread(pulumiCommentThreads[0])
                    ?.id,
            },
            azureRepoInfo.repositoryId,
            buildEnvInfo.prId,
            pulumiCommentThreads[0].id!,
            azureRepoInfo.projectId
        );

        return true;
    }

    tl.debug(tl.loc("Debug_ExistingThreadNotFound"));
    return false;
}

async function createThread(
    buildEnvInfo: BuildEnvInfo,
    azureRepoInfo: AzureGitRepoInfo,
    gitApi: IGitApi,
    content: string
) {
    await gitApi.createThread(
        {
            comments: [
                {
                    commentType: CommentType.System,
                    content,
                },
            ],
            status: CommentThreadStatus.Active,
            // Attach metadata to the thread so we can find this specific thread later
            // if we need to update it with another comment.
            properties: defaultCommentThreadProperties,
        },
        azureRepoInfo.repositoryId,
        buildEnvInfo.prId,
        azureRepoInfo.projectId
    );
}
