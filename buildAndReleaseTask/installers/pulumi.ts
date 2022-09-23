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

export async function installPulumi(
    latestPulumiVersion: string,
    versionSpec?: string
): Promise<string> {
    const os = tl.getPlatform();
    tl.debug(tl.loc("OSDETECTED", os));

    if (!versionSpec || versionSpec.toLowerCase() === "latest") {
        versionSpec = latestPulumiVersion;
    }
    tl.debug(`Pulumi version to install is ${versionSpec}`);

    switch (os) {
        case tl.Platform.Windows:
            await installPulumiWindows(versionSpec);
            break;
        case tl.Platform.MacOS:
            await installPulumiOther(versionSpec, "darwin");
            break;
        case tl.Platform.Linux:
            await installPulumiOther(versionSpec, "linux");
            break;
        default:
            throw new Error(`Unexpected OS platform type "${os}"`);
    }

    return versionSpec;
}

async function installPulumiWindows(version: string) {
    try {
        const downloadUrl = `https://get.pulumi.com/releases/sdk/pulumi-v${version}-windows-x64.zip`;
        const temp = await lib.downloadTool(downloadUrl);
        const extractTemp = await lib.extractZip(temp);
        // Windows archives have a sub-folder called "bin", so add that
        // to the PATH.
        const binPath = path.join(extractTemp, "pulumi", "bin");
        lib.prependPath(binPath);
        tl.debug(tl.loc("Debug_Installed"));
        tl.debug(tl.loc("Debug_AddedToPATH"));
        await lib.cacheDir(binPath, "pulumi", version);
    } catch (err: any) {
        tl.setResult(
            tl.TaskResult.Failed,
            tl.loc("PulumiInstallFailed", err.message),
            true
        );
    }
}

async function installPulumiOther(version: string, os: string) {
    try {
        const downloadUrl = `https://get.pulumi.com/releases/sdk/pulumi-v${version}-${os}-x64.tar.gz`;
        const temp = await lib.downloadTool(downloadUrl);
        const extractTemp = await lib.extractTar(temp);
        // Pulumi binary exists in "pulumi" sub-folder,
        // so use this folder to prepend to path and cache
        const binPath = path.join(extractTemp, "pulumi");
        lib.prependPath(binPath);
        tl.debug(tl.loc("Debug_Installed"));
        tl.debug(tl.loc("Debug_AddedToPATH"));
        await lib.cacheDir(binPath, "pulumi", version);
    } catch (err: any) {
        tl.setResult(
            tl.TaskResult.Failed,
            tl.loc("PulumiInstallFailed", err.message),
            true
        );
    }
}
