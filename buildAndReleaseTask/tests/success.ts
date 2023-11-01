// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as ma from "azure-pipelines-task-lib/mock-answer";
import * as tmrm from "azure-pipelines-task-lib/mock-run";
import * as path from "path";

import { IAWSServiceEndpoint } from "../awsServiceEndpoint";
import { IServiceEndpoint } from "../serviceEndpoint";

const taskPath = path.join(__dirname, "..", "index.js");
const tmr = new tmrm.TaskMockRunner(taskPath);

const fakeOS = "Linux";
// https://github.com/microsoft/azure-pipelines-task-lib/blob/master/node/task.ts#L51
const fakePlatform = 2;
const latestPulumiVersion = "1.5.1";
// If the user requested version is not `latest`, then this is the version
// that the task should install.
const userRequestedVersion = "0.16.5";
const expectedDownloadUrl = `https://get.pulumi.com/releases/sdk/pulumi-v${userRequestedVersion}-${fakeOS.toLowerCase()}-x64.tar.gz`;
const fakeDownloadedPath = "/fake/path/to/downloaded/file";

process.env["HOME"] = "/fake/home";

tmr.setVariableName("PULUMI_ACCESS_TOKEN", "fake-access-token", true);
// Set the mock inputs for the task.
tmr.setInput("azureSubscription", "fake-subscription-id");
tmr.setInput("awsServiceConnection", "fake-aws-service-endpoint");
tmr.setInput("command", "preview");
tmr.setInput("cwd", "dir/");
tmr.setInput("stack", "myOrg/project/dev");
tmr.setInput("versionSpec", userRequestedVersion);

tmr.registerMock("./serviceEndpoint", {
    getServiceEndpoint: (_: string): IServiceEndpoint => {
        return {
            clientId: "fake-client-id",
            servicePrincipalKey: "fake-sp-key",
            subscriptionId: "fake-subscription-id",
            tenantId: "fake-tenant-id",
        };
    },
});

tmr.registerMock("./awsServiceEndpoint", {
    getAWSServiceEndpoint: (_: string): IAWSServiceEndpoint => {
        return {
            accessKeyId: "fake-access-key-id",
            secretAccessKey: "fake-secret-access-key",
            sessionToken: "fake-session-token",
            roleArn: "fake-role-arn",
            region: "fake-region",
        }
    },
});

tmr.registerMock("./version", {
    getLatestPulumiVersion: (): Promise<string> => {
        return Promise.resolve(latestPulumiVersion);
    },
});

tmr.registerMock("azure-pipelines-tool-lib", {
    cacheDir: () => {
        return Promise.resolve("/cache");
    },
    downloadTool: (url: string) => {
        if (url !== expectedDownloadUrl) {
            throw new Error(`Unexpected download url ${url}.`);
        }
        return Promise.resolve(fakeDownloadedPath);
    },
    extractTar: (downloadedPath: string) => {
        if (downloadedPath !== fakeDownloadedPath) {
            throw new Error(
                `Unexpected downloaded file path ${downloadedPath}`
            );
        }
        return Promise.resolve("/fake/path/to/extracted/contents");
    },
    extractZip: (downloadedPath: string) => {
        if (downloadedPath !== fakeDownloadedPath) {
            throw new Error(
                `Unexpected downloaded file path ${downloadedPath}`
            );
        }
        return Promise.resolve("/fake/path/to/extracted/contents");
    },
    prependPath: (pathToTool: string) => {
        console.log(`prepending path ${pathToTool}`);
    },
});

tmr.registerMock("azure-pipelines-tool-lib/tool", {
    findLocalTool: (toolName: string, version: string) => {
        console.log(`Requested tool ${toolName} of version ${version}`);
        return undefined;
    },
});

// Provide answers for task mock.
const mockAnswers: ma.TaskLibAnswers = {
    checkPath: {
        "/fake/path/to/pulumi": true,
    },
    exec: {
        "/fake/path/to/pulumi login": {
            code: 0,
            stdout: "fake logged in",
        },
        "/fake/path/to/pulumi preview": {
            code: 0,
            stdout: "fake pulumi preview",
        },
        "/fake/path/to/pulumi stack select myOrg/project/dev": {
            code: 0,
            stdout: "stack selected",
        },
        "/fake/path/to/pulumi version": {
            code: 0,
            stdout: userRequestedVersion,
        },
    },
    osType: {
        osType: fakeOS,
    },
    getPlatform: {
        getPlatform: fakePlatform,
    },
    which: {
        "/fake/path/to/pulumi": "/fake/path/to/pulumi",
        pulumi: "/fake/path/to/pulumi",
    },
} as ma.TaskLibAnswers;

tmr.setAnswers(mockAnswers);

tmr.run();
