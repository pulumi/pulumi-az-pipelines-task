// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as toolLib from "azure-pipelines-tool-lib/tool";
import * as path from "path";
import { installUsingCurl } from "./installers/curl";
import { installUsingPowerShell } from "./installers/powershell";

const pulumiVersion = "0.17.5";

async function run() {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    tl.debug(tl.loc("Debug_Starting"));

    let toolPath = toolLib.findLocalTool("pulumi", pulumiVersion);
    if (!toolPath) {
        tl.debug(tl.loc("Debug_NotFoundInCache"));
        try {
            const exitCode = await installPulumi();
            if (exitCode !== 0) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("JS_ExitCode", exitCode));
                return;
            }
            // We just installed Pulumi, so prepend the installation path.
            toolLib.prependPath(path.join(process.env.HOME as string, ".pulumi", "bin"));
            tl.debug(tl.loc("Debug_AddedToPATH"));
        } catch (err) {
            tl.setResult(tl.TaskResult.Failed, err);
            return;
        }
    } else {
        // Prepend the tools path. Instructs the agent to prepend for future tasks.
        toolLib.prependPath(path.join(toolPath, "bin"));
    }

    try {
        tl.debug(tl.loc("Debug_Installed"));
        // Print the version.
        toolPath = tl.which("pulumi");
        tl.debug(tl.loc("Debug_PrintToolPath", toolPath));
        if (!toolPath) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiNotFound"));
            return;
        }
        tl.debug(tl.loc("Debug_PrintingVersion"));
        await tl.exec(toolPath, "version");

        // Login and then run the command.
        tl.debug(tl.loc("Debug_Login"));
        let exitCode = await tl.exec(toolPath, "login");
        if (exitCode !== 0) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiLoginFailed"));
            return;
        }

        // Get the working directory where the Pulumi commands must be run.
        const pulCwd = tl.getInput("cwd") || ".";
        // Select the stack.
        const pulStack = tl.getInput("stack", true);
        await tl.exec(toolPath, ["--cwd", pulCwd, "stack", "select", pulStack]);

        // Get the command, and the args the user wants to pass to the Pulumi CLI.
        const pulCommand = tl.getInput("command");
        const pulCommandRunner =
            await tl.tool(toolPath)
                    .arg("--cwd")
                    .arg(pulCwd)
                    .arg(pulCommand);
        const pulArgs = tl.getDelimitedInput("args", " ");
        pulArgs.forEach((arg: string) => {
            pulCommandRunner.arg(arg);
        });
        exitCode = await pulCommandRunner.exec();
        if (exitCode !== 0) {
            tl.setResult(tl.TaskResult.Failed,
                tl.loc("PulumiCommandFailed", exitCode, `${ pulCommand } ${ pulArgs.join(" ") }`));
            return;
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

async function installPulumi(): Promise<number> {
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
        return exitCode;
    }

    await toolLib.cacheDir(path.join(process.env.HOME as string, ".pulumi"), "pulumi", pulumiVersion);
    return 0;
}

// tslint:disable-next-line no-floating-promises
run();
