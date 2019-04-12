// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as toolLib from "azure-pipelines-tool-lib/tool";
import * as path from "path";
import { installUsingCurl } from "./installers/curl";
import { installUsingPowerShell } from "./installers/powershell";

const pulumiVersion = "0.17.5";

async function run() {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    console.log("Starting");

    let toolPath = toolLib.findLocalTool("pulumi", pulumiVersion);
    if (!toolPath) {
        tl.debug(tl.loc("NotFoundInCache"));
        try {
            await installPulumi();
            // We just installed Pulumi, so prepend the installation path.
            toolLib.prependPath(`${process.env.HOME}/.pulumi/bin`);
        } catch (err) {
            tl.setResult(tl.TaskResult.Failed, err);
            return;
        }
    } else {
        // Prepend the tools path. Instructs the agent to prepend for future tasks.
        toolLib.prependPath(`${toolPath}/bin`);
    }

    console.log("Installed");
    // Print the version.
    toolPath = tl.which("pulumi");
    console.log("toolPath is", toolPath);
    if (!toolPath) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiNotFound"));
        return;
    }
    console.log("Printing version");
    await tl.exec(toolPath, "version");

    // Login and then run the command.
    console.log("Performing a login");
    let exitCode = await tl.exec(toolPath, "login");
    if (exitCode !== 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiLoginFailed"));
        return;
    }

    // Get the command, and the args the user wants to pass to the Pulumi CLI.
    const pulCommand = tl.getInput("pulCommand");
    const pulCommandRunner = await tl.tool(toolPath).arg(pulCommand);
    const pulArgs = tl.getDelimitedInput("pulArgs", " ");
    pulArgs.forEach((arg: string) => {
        pulCommandRunner.arg(arg);
    });
    exitCode = await pulCommandRunner.exec();
    if (exitCode !== 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiLoginFailed"));
        return;
    }
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
