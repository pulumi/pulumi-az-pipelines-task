// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib";
import * as ma from "azure-pipelines-task-lib/mock-answer";
import * as tmrm from "azure-pipelines-task-lib/mock-run";
import * as path from "path";
import { IServiceEndpoint } from "serviceEndpoint";

const taskPath = path.join(__dirname, "..", "index.js");
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

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

tmr.registerMock("azure-pipelines-tool-lib/tool", {
    cacheDir: () => {
        return Promise.resolve("/cache");
    },
});

tmr.setInput("azureSubscription", "fake-subscription-id");
tmr.setInput("command", "preview");
tmr.setInput("cwd", "dir/");
tmr.setInput("stack", "myOrg/project/dev");

process.env["HOME"] = "/fake/home";

// Provide answers for task mock.
const mockAnswers: ma.TaskLibAnswers = {
    getPlatform: {
        "": tl.Platform.Linux,
    },
    which: {
        curl: "/fake/path/to/curl",
        sh: "/fake/path/to/sh",
        pulumi: "/fake/path/to/pulumi",
    },
    exec: {
        "/fake/path/to/curl -fsSL https://get.pulumi.com | sh": {
            code: 0,
            stdout: "Pulumi installed via curl",
        },
        "/fake/path/to/pulumi version": {
            code: 0,
            stdout: "0.17.5",
        },
        "/fake/path/to/pulumi stack select myOrg/project/dev": {
            code: 0,
            stdout: "stack selected",
        },
        "/fake/path/to/pulumi login": {
            code: 0,
            stdout: "fake logged in",
        },
        "/fake/path/to/pulumi preview": {
            code: 0,
            stdout: "fake pulumi preview",
        },
    },
} as ma.TaskLibAnswers;

tmr.setAnswers(mockAnswers);

tmr.run();
