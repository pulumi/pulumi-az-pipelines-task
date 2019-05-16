// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as ma from "azure-pipelines-task-lib/mock-answer";
import * as tmrm from "azure-pipelines-task-lib/mock-run";
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";
import * as path from "path";

import { IServiceEndpoint } from "../serviceEndpoint";

const taskPath = path.join(__dirname, "..", "index.js");
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const pulumiVersion = "0.17.8";

process.env["HOME"] = "/fake/home";

tmr.setVariableName("PULUMI_ACCESS_TOKEN", "fake-access-token", true);
tmr.setInput("azureSubscription", "fake-subscription-id");
tmr.setInput("command", "preview");
tmr.setInput("cwd", "dir/");
tmr.setInput("stack", "myOrg/project/dev");
tmr.setInput("expectedVersion", "0.17.9");

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

tmr.registerMock("./version", {
    getLatestPulumiVersion: (): Promise<string> => {
        return Promise.resolve(pulumiVersion);
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
    prependPath: (pathToTool: string) => {
        console.log(`prepending path ${ pathToTool }`);
    },
});

tmr.registerMock("azure-pipelines-task-lib/toolrunner", {
    exec: () => {
        return Promise.resolve();
    },
    pipeExecOutputToTool: () => {
        console.log("piping fake tool");
        return new ToolRunner("/fake/tool");
    },
});

tmr.registerMock("./installers/pulumi", {
    installPulumiWithToolLib: (expectedVersion: string, latestPulumiVersion: string) => {
        console.log(`Pulumi version ${ expectedVersion } installed. Latest version was ${ latestPulumiVersion }`);
    }
})

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
            stdout: pulumiVersion,
        },
    },
    getPlatform: {
        getPlatform: 2,
    },
    osType: {
        osType: "Linux",
    },
    which: {
        "/fake/path/to/pulumi": "/fake/path/to/pulumi",
        "pulumi": "/fake/path/to/pulumi",
        "sh": "/fake/path/to/sh",
    },
} as ma.TaskLibAnswers;

tmr.setAnswers(mockAnswers);

tmr.run();
