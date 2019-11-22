// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as ma from "azure-pipelines-task-lib/mock-answer";
import * as tmrm from "azure-pipelines-task-lib/mock-run";
import * as path from "path";

const taskPath = path.join(__dirname, "..", "index.js");
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const fakeOS = "Linux";
const latestPulumiVersion = "1.5.1";
// If the user requested version is not `latest`, then this is the version
// that the task should install.
export const userRequestedVersion = "0.16.5";
const expectedDownloadUrl =
    `https://get.pulumi.com/releases/sdk/pulumi-v${userRequestedVersion}-${fakeOS.toLowerCase()}-x64.tar.gz`;
const fakeDownloadedPath = "/fake/path/to/downloaded/file";

process.env["HOME"] = "/fake/home";
tmr.setVariableName("AZURE_STORAGE_CONTAINER", "fake-azure-container", true);
tmr.setVariableName("AZURE_STORAGE_ACCOUNT", "fake-azure-account", true);
tmr.setVariableName("AZURE_STORAGE_KEY", "fake-azure-key", true);
tmr.setVariableName("AWS_ACCESS_KEY_ID", "fake-access-key-id", false);
tmr.setVariableName("AWS_SECRET_ACCESS_KEY", "fake-secret-access-key", true);

// Set the mock inputs for the task. These imitate actual user inputs.
tmr.setInput("command", "preview");
tmr.setInput("cwd", "dir/");
tmr.setInput("stack", "myOrg/project/dev");
tmr.setInput("versionSpec", userRequestedVersion);

tmr.registerMock("./serviceEndpoint", {
    getServiceEndpoint: (_: string) => {
        // Returning undefined to test that our task extension isn't requiring
        // an Azure Service Endpoint.
        return undefined;
    },
});

tmr.registerMock("./version", {
    getLatestPulumiVersion: (): Promise<string> => {
        return Promise.resolve(latestPulumiVersion);
    },
});

tmr.registerMock("azure-pipelines-tool-lib", {
    downloadTool: (url: string) => {
        if (url !== expectedDownloadUrl) {
            throw new Error(`Unexpected download url ${url}.`);
        }
        return Promise.resolve(fakeDownloadedPath);
    },
    extractTar: (downloadedPath: string) => {
        if (downloadedPath !== fakeDownloadedPath) {
            throw new Error(`Unexpected downloaded file path ${downloadedPath}`);
        }
        return Promise.resolve("/fake/path/to/extracted/contents");
    },
    extractZip: (downloadedPath: string) => {
        if (downloadedPath !== fakeDownloadedPath) {
            throw new Error(`Unexpected downloaded file path ${downloadedPath}`);
        }
        return Promise.resolve("/fake/path/to/extracted/contents");
    },
    prependPath: (pathToTool: string) => {
        console.log(`prepending path ${ pathToTool }`);
    },
});

tmr.registerMock("azure-pipelines-tool-lib/tool", {
    cacheDir: () => {
        return Promise.resolve("/cache");
    },
    findLocalTool: (toolName: string, version: string) => {
        console.log(`Requested tool ${ toolName } of version ${ version }`);
        return undefined;
    },
});

// Provide answers for task mock.
const mockAnswers: ma.TaskLibAnswers = {
    checkPath: {
        "/fake/path/to/pulumi": true,
    },
    exec: {
        "/fake/path/to/pulumi login -c azblob://fake-azure-container": {
            code: 0,
            stdout: "fake logged in using azure storage",
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
    which: {
        "/fake/path/to/pulumi": "/fake/path/to/pulumi",
        "pulumi": "/fake/path/to/pulumi",
    },
} as ma.TaskLibAnswers;

tmr.setAnswers(mockAnswers);

tmr.run();
