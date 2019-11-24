// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as lib from "azure-pipelines-tool-lib";
import * as path from "path";

/**
 * Function installs Pulumi across Operating Systems using the Build agent's native SDK libraries.
 * This Function does not check if the user input for versionSpec is greater
 * than the latest available version and will result in an error if the user input was wrong.
 * @param versionSpec version number the user wants to install.
 * @param latestPulumiVersion latest version based on what `getLatestPulumiVersion` returned.
 */

export async function installPulumi(latestPulumiVersion: string, versionSpec?: string): Promise<string> {
    const os = tl.osType();
    tl.debug(tl.loc("OSDETECTED", os));

    if (!versionSpec || versionSpec.toLowerCase() === "latest") {
        versionSpec = latestPulumiVersion;
    }
    tl.debug(`Pulumi version to install is ${versionSpec}`);

    switch (os.toLowerCase()) {
        case "windows_nt":
            await installPulumiWindows(versionSpec);
            break;
        case "macos":
        case "linux":
            await installPulumiLinux(versionSpec, os.toLowerCase());
            break;
        default:
            throw new Error(`Unexpected OS "${os.toLowerCase()}"`);
    }

    return versionSpec;
}

async function installPulumiWindows(version: string) {
    try {
        const downloadUrl =
            `https://get.pulumi.com/releases/sdk/pulumi-v${version}-windows-x64.zip`;
        const temp = await lib.downloadTool(downloadUrl);
        const extractTemp = await lib.extractZip(temp);
        await lib.prependPath(path.join(extractTemp, "pulumi/bin"));
        tl.debug(tl.loc("Debug_Installed"));
        tl.debug(tl.loc("Debug_AddedToPATH"));
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiInstallFailed", err.message), true);
    }
}

async function installPulumiLinux(version: string, os: string) {
    try {
        const downloadUrl =
            `https://get.pulumi.com/releases/sdk/pulumi-v${version}-${os}-x64.tar.gz`;
        const temp = await lib.downloadTool(downloadUrl);
        const extractTemp = await lib.extractTar(temp);
        lib.prependPath(path.join(extractTemp, "pulumi"));
        tl.debug(tl.loc("Debug_Installed"));
        tl.debug(tl.loc("Debug_AddedToPATH"));
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiInstallFailed", err.message), true);
    }
}
