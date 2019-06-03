// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as toolLib from "azure-pipelines-tool-lib/tool";
import * as path from "path";

import { installPulumi } from "./installers/pulumi";
import { runPulumi } from "./pulumi";
import { getServiceEndpoint } from "./serviceEndpoint";
import { getLatestPulumiVersion } from "./version";

import { INSTALLED_PULUMI_VERSION } from "./vars";

let latestPulumiVersion: string;

async function run() {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    tl.debug(tl.loc("Debug_Starting"));

    let versionSpec = tl.getInput("versionSpec", false);
    tl.debug(tl.loc("Debug_ExpectedPulumiVersion", versionSpec));

    // Check if another version is already installed and use that instead of the requested version.
    // If there is no previously installed version, then fetch the latest version.
    const installedPulumiVersion = tl.getVariable(INSTALLED_PULUMI_VERSION);
    if (installedPulumiVersion) {
        versionSpec = installedPulumiVersion;
        // If a version spec was specified, let the user know we are ignoring the value.
        if (versionSpec && versionSpec !== installedPulumiVersion) {
            tl.warning(tl.loc("DetectedVersion", INSTALLED_PULUMI_VERSION, installedPulumiVersion));
        }
    } else {
        latestPulumiVersion = await getLatestPulumiVersion();
    }

    const connectedServiceName = tl.getInput("azureSubscription", true);
    tl.debug(tl.loc("Debug_ServiceEndpointName", connectedServiceName));

    const serviceEndpoint = getServiceEndpoint(connectedServiceName);
    tl.debug(`Service endpoint retrieved with client ID ${serviceEndpoint.clientId}`);

    const toolPath = toolLib.findLocalTool("pulumi", versionSpec || latestPulumiVersion);
    if (!toolPath) {
        tl.debug(tl.loc("Debug_NotFoundInCache"));
        try {
            const installedVersion = await installPulumi(versionSpec, latestPulumiVersion);
            if (installedVersion) {
                tl.setVariable(INSTALLED_PULUMI_VERSION, installedVersion);
            }
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

// tslint:disable-next-line no-floating-promises
run();
