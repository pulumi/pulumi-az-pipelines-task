// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as lib from "azure-pipelines-tool-lib";
import * as path from "path";

export async function installPulumiWithToolLib(expectedVersion: string, latestPulumiVersion: string) {

  const os: string = tl.osType();
  tl.debug(tl.loc("OSDETECTED", os));
  if (expectedVersion.toLowerCase() === "latest") {
    expectedVersion = latestPulumiVersion;
  }
  tl.debug("Pulumi version to install is " + expectedVersion);

  switch (os.toLowerCase()) {
    case "windows_nt":
      await installPulumiWindows(expectedVersion);
      break;
    case "MacOS":
    case "linux":
      await installPulumiLinux(expectedVersion, os.toLowerCase());
      break;
    default:
      throw new Error(`Unexpected OS "${os.toLowerCase()}"`);
  }
}

async function installPulumiWindows(version: string) {
  try {
    let downloadUrl: string;
    downloadUrl = "https://get.pulumi.com/releases/sdk/pulumi-v" + version + "-windows-x64.zip";
    const temp: string = await lib.downloadTool(downloadUrl);
    const extractTemp: string = await lib.extractZip(temp);
    await lib.prependPath(path.join(extractTemp, "pulumi/bin"));
    tl.debug(tl.loc("Debug_Installed"));
    tl.debug(tl.loc("Debug_AddedToPATH"));
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiInstallFailed", err.message));
  }
}

async function installPulumiLinux(version: string, os: string) {
  try {
    let downloadUrl: string;
    // tslint:disable-next-line:max-line-length
    downloadUrl = "https://get.pulumi.com/releases/sdk/pulumi-v" + version + "-" + os + "-x64.tar.gz";
    const temp: string = await lib.downloadTool(downloadUrl);
    const extractTemp: string = await lib.extractTar(temp);
    lib.prependPath(path.join(extractTemp, "pulumi"));
    tl.debug(tl.loc("Debug_Installed"));
    tl.debug(tl.loc("Debug_AddedToPATH"));
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiInstallFailed", err.message));
  }
}