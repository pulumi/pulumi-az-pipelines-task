// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as toolLib from "azure-pipelines-tool-lib/tool";
import * as path from "path";

import { installPulumiWithToolLib } from "./installers/pulumi";
import { runPulumi } from "./pulumi";
import { getServiceEndpoint } from "./serviceEndpoint";
import { getLatestPulumiVersion } from "./version";

let latestPulumiVersion: string;
let expectedVersion: string;

async function run() {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    tl.debug(tl.loc("Debug_Starting"));

    latestPulumiVersion = await getLatestPulumiVersion();

    expectedVersion = tl.getInput("expectedVersion", false);
    tl.debug(tl.loc("Debug_ExpectedPulumiVersion", expectedVersion));
    const connectedServiceName = tl.getInput("azureSubscription", true);
    tl.debug(tl.loc("Debug_ServiceEndpointName", connectedServiceName));
    const serviceEndpoint = getServiceEndpoint(connectedServiceName);
    tl.debug(`Service endpoint retrieved with client ID ${serviceEndpoint.clientId}`);

    const toolPath = toolLib.findLocalTool("pulumi", latestPulumiVersion);
    if (!toolPath) {
        tl.debug(tl.loc("Debug_NotFoundInCache"));
        try {
            await installPulumi(expectedVersion, latestPulumiVersion);
        } catch (err) {
            tl.setResult(tl.TaskResult.Failed, err);
            return;
        }
    } else {
        // Prepend the tools path. Instructs the agent to prepend for future tasks.
        toolLib.prependPath(path.join(toolPath, "bin"));
    }

    tl.debug(tl.loc("Debug_Installed"));
    await runPulumi(serviceEndpoint);
}

async function installPulumi(expectedPulumiVersion: string, lastPulumiVersion: string) {

    await installPulumiWithToolLib(expectedPulumiVersion, lastPulumiVersion);

    // tl.debug(`process.env: ${JSON.stringify(process.env)}`);
    // const cachePath = path.join(getHomePath(), ".pulumi");
    // tl.debug(tl.loc("Debug_CachingPulumiToHome", cachePath));
    // await toolLib.cacheDir(cachePath, "pulumi", pulumiVersion);
    // return 0;
}

// tslint:disable-next-line no-floating-promises
run();
