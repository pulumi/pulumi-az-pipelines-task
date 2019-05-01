// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as toolLib from "azure-pipelines-tool-lib/tool";
import * as path from "path";

import { installUsingCurl } from "./installers/curl";
import { installUsingPowerShell } from "./installers/powershell";
import { runPulumi } from "./pulumi";
import { getServiceEndpoint } from "./serviceEndpoint";
import { getLatestPulumiVersion } from "./version";

let pulumiVersion: string;

async function run() {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    tl.debug(tl.loc("Debug_Starting"));

    pulumiVersion = await getLatestPulumiVersion();

    const connectedServiceName = tl.getInput("azureSubscription", true);

    tl.debug(tl.loc("Debug_ServiceEndpointName", connectedServiceName));
    const serviceEndpoint = getServiceEndpoint(connectedServiceName);
    tl.debug(`Service endpoint retrieved with client ID ${serviceEndpoint.clientId}`);

    const toolPath = toolLib.findLocalTool("pulumi", pulumiVersion);
    if (!toolPath) {
        tl.debug(tl.loc("Debug_NotFoundInCache"));
        try {
            const exitCode = await installPulumi();
            if (exitCode !== 0) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("JS_ExitCode", exitCode));
                return;
            }
            // We just installed Pulumi, so prepend the installation path.
            toolLib.prependPath(path.join(getHomePath(), ".pulumi", "bin"));
            tl.debug(tl.loc("Debug_AddedToPATH"));
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

async function installPulumi(): Promise<number> {
    const osPlat = tl.osType();
    let exitCode: number;

    switch (osPlat) {
    case "Linux":
    case "MacOS":
        exitCode = await installUsingCurl();
        break;
    case "Windows_NT":
        exitCode = await installUsingPowerShell();
        break;
    default:
        throw new Error(`Unexpected OS "${osPlat}"`);
    }

    if (exitCode !== 0) {
        return exitCode;
    }

    tl.debug(`process.env: ${ JSON.stringify(process.env) }`);
    const cachePath = path.join(getHomePath(), ".pulumi");
    tl.debug(tl.loc("Debug_CachingPulumiToHome", cachePath));
    await toolLib.cacheDir(cachePath, "pulumi", pulumiVersion);
    return 0;
}

function getHomePath(): string {
    const osPlat = tl.osType();
    let homePath: string;

    switch (osPlat) {
    case "Linux":
    case "MacOS":
        homePath = process.env.HOME as string;
        break;
    case "Windows_NT":
        homePath = process.env.USERPROFILE as string;
        break;
    default:
        throw new Error(`Unexpected OS "${osPlat}"`);
    }

    return homePath;
}

// tslint:disable-next-line no-floating-promises
run();
