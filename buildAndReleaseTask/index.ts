// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as toolLib from "azure-pipelines-tool-lib/tool";
import * as path from "path";

import { installPulumi } from "./installers/pulumi";
import { runPulumi } from "./pulumi";
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
            tl.warning(
                tl.loc(
                    "DetectedVersion",
                    INSTALLED_PULUMI_VERSION,
                    installedPulumiVersion
                )
            );
        }
    } else {
        latestPulumiVersion = await getLatestPulumiVersion();
    }

    const searchVersion = versionSpec || latestPulumiVersion;
    const toolPath = toolLib.findLocalTool("pulumi", searchVersion);
    if (!toolPath) {
        tl.debug(tl.loc("Debug_NotFoundInCache"));
        try {
            const installedVersion = await installPulumi(
                latestPulumiVersion,
                versionSpec
            );
            if (installedVersion) {
                tl.setVariable(INSTALLED_PULUMI_VERSION, installedVersion);
            }
        } catch (err: any) {
            tl.setResult(tl.TaskResult.Failed, err);
            return;
        }
    } else {
        // Prepend the cached tool's path.
        toolLib.prependPath(toolPath);
        // Set the installed Pulumi version variable to indicate to future steps
        // the version of the CLI to use.
        tl.setVariable(INSTALLED_PULUMI_VERSION, searchVersion);
    }

    tl.debug(tl.loc("Debug_Installed"));

    // Print the CLI version always so it is easy to debug issues.
    const pulumi = tl.which("pulumi");
    tl.debug(tl.loc("Debug_PrintToolPath", pulumi));
    if (!pulumi) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiNotFound"));
        return;
    }
    tl.debug(tl.loc("Debug_PrintingVersion"));
    await tl.exec(pulumi, "version");

    // The main Pulumi command to run is optional.
    // If the user did not provide one, then we'll
    // assume they just wanted to install the CLI.
    const pulCommand = tl.getInput("command");
    if (!pulCommand) {
        tl.debug(tl.loc("Debug_InstallOnly"));
        return;
    }

    await runPulumi();
}

// tslint:disable-next-line no-floating-promises
run();
