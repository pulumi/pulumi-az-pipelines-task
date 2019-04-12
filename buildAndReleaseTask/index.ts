// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as toolLib from "azure-pipelines-tool-lib/tool";
import * as path from "path";
import { installUsingCurl } from "./installers/curl";
import { installUsingPowerShell } from "./installers/powershell";

const pulumiVersion = "0.17.5";

async function run() {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    let toolPath = toolLib.findLocalTool("pulumi", pulumiVersion);
    if (!toolPath) {
        tl.debug(tl.loc("NotFoundInCache"));
        try {
            await installPulumi();
        } catch (err) {
            tl.setResult(tl.TaskResult.Failed, err);
            return;
        }
    } else {
        // Prepend the tools path. Instructs the agent to prepend for future tasks.
        toolLib.prependPath(`${toolPath}/bin`);
    }

    // Print the version.
    await tl.exec(tl.which("pulumi"), "version");
}

async function installPulumi() {
    const osPlat = tl.getPlatform();
    let exitCode: number;

    switch (osPlat) {
    case tl.Platform.Linux:
    case tl.Platform.MacOS:
        exitCode = await installUsingCurl();
        break;
    case tl.Platform.Windows:
        exitCode = await installUsingPowerShell();
        break;
    default:
        throw new Error(`Unexpected OS "${osPlat}"`);
    }

    if (exitCode !== 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("ResultCodeNotZero"));
        return;
    }

    await toolLib.cacheDir(`${process.env.HOME}/.pulumi`, "pulumi", pulumiVersion);
}

run();
