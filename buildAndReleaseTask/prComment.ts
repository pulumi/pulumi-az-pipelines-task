import {readFileSync} from "fs";
import {join as pathJoin} from "path";

import * as azdev from "azure-devops-node-api";

import * as tl from "azure-pipelines-task-lib/task";

import { IGitApi } from "azure-devops-node-api/GitApi";
import { Comment, CommentThread, CommentThreadStatus, CommentType } from "azure-devops-node-api/interfaces/GitInterfaces";

export const PULUMI_LOG_FILENAME = "pulumi-out.log";

const SOURCE_PULUMI = "Pulumi";
const defaultCommentThreadProperties = {
    "source": SOURCE_PULUMI
};

function getFormattedPulumiLogs(pulumiLogs: string, pulCommand: string, pulStackFqdn: string): string {
    const heading = `#### :tropical_drink: \`${pulCommand}\` on ${pulStackFqdn}`;
    const summary = '<summary>Pulumi report</summary>';
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
export async function createPrComment() {
    // This function depends on various predefined variables found in
    // a typical Azure build pipeline.
    // See https://docs.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml.

    const shouldCreatePrComment = tl.getBoolInput("createPrComment");
    if (!shouldCreatePrComment) {
        return;
    }

    const repoProvider = tl.getVariable("Build.Repository.Provider");
    if (repoProvider !== "TfsGit") {
        tl.warning(tl.loc("Warning_UnSupportedRepositoryType", repoProvider));
        return;
    }

    // The main Pulumi command to run is optional.
    // If the user did not provide one, then we'll
    // assume they just wanted to install the CLI.
    const pulCommand = tl.getInput("command");
    if (!pulCommand) {
        return;
    }

    // This will throw if the input is missing.
    const pulStackFqdn = tl.getInput("stack", true);

    const accessToken = tl.getVariable("System.AccessToken");
    if (!accessToken) {
        throw new Error("Job access token is required to create/update PR comment");
    }

    const baseUri = tl.getVariable("System.CollectionUri");
    if (!baseUri) {
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

    const prIdInt = parseInt(prId, 10);

    const authHandler = azdev.getBearerHandler(accessToken);
    const webApi = new azdev.WebApi(baseUri, authHandler);
    const gitApi = await webApi.getGitApi();

    const pulumiLogs = readFileSync(pathJoin(".", PULUMI_LOG_FILENAME), {
        encoding: "utf-8"
    });

    const commentBody = getFormattedPulumiLogs(pulumiLogs, pulCommand, pulStackFqdn!);

    const useThreads = tl.getBoolInput("useThreadedPrComments");
    if (useThreads) {
        const threads = await gitApi.getThreads(repositoryId, prIdInt, projectId);
        tl.debug(JSON.stringify(threads));

        const pulumiCommentThreads = threads.filter(t => t.status === CommentThreadStatus.Active && t.properties["source"]["$value"] === SOURCE_PULUMI);
        // If we found a previous thread, add a comment to it.
        if (pulumiCommentThreads?.length > 0) {
            // Sort the threads in descending order of their published date,
            // so that we can add a comment to the latest one.
            // This isn't necessarily needed since there is likely ever going to be
            // a single thread started by this task that matches the above criteria.
            // But it's useful when testing the task in a dev build.
            pulumiCommentThreads.sort((a, b) => b.publishedDate!.getTime() - a.publishedDate!.getTime());

            tl.debug(tl.loc("Debug_ThreadFound"));

            await gitApi.createComment({
                commentType: CommentType.System,
                content: commentBody,
                // Use the last comment in the thread as the parent id.
                parentCommentId: getLastCommentInThread(pulumiCommentThreads[0])?.id,
            }, repositoryId, prIdInt, pulumiCommentThreads[0].id!, projectId);

            return;
        }

        tl.debug(tl.loc("Debug_ExistingThreadNotFound"));
    }

    await createThread(gitApi, repositoryId, projectId, prIdInt, commentBody);
}

async function createThread(gitApi: IGitApi, repositoryId: string, projectId: string, prId: number, content: string) {
    await gitApi.createThread({
        comments: [
            {
                commentType: CommentType.System,
                content,
            }
        ],
        status: CommentThreadStatus.Active,
        properties: defaultCommentThreadProperties
    }, repositoryId, prId, projectId);
}
