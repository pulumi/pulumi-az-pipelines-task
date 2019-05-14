// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as lib from "azure-pipelines-tool-lib";
import * as path from "path";

export async function installPulumiWithToolLib(expectedVersion: string, latestPulumiVersion: string) {

  let downloadUrl: string;
  const os: string = tl.osType();
  tl.debug(tl.loc("OSDETECTED", os));
  if (expectedVersion.toLowerCase() === "latest") {
    expectedVersion = latestPulumiVersion;
  }
  tl.debug("Pulumi version to install is " + expectedVersion);

  if (os.toLowerCase() === "windows_nt") {
    try {
      downloadUrl = "https://get.pulumi.com/releases/sdk/pulumi-v" + expectedVersion + "-windows-x64.zip";
      const temp: string = await lib.downloadTool(downloadUrl);
      const extractTemp: string = await lib.extractZip(temp);
      lib.prependPath(path.join(extractTemp, "pulumi"));
      tl.debug(tl.loc("Debug_Installed"));
      tl.debug(tl.loc("Debug_AddedToPATH"));
    } catch (err) {
      tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiInstallFailed", err.message));
    }
  }
  if (os.toLowerCase() === "linux") {
    try {
      // tslint:disable-next-line:max-line-length
      downloadUrl = "https://get.pulumi.com/releases/sdk/pulumi-v" + expectedVersion + "-" + os.toLowerCase() + "-x64.tar.gz";
      const temp: string = await lib.downloadTool(downloadUrl);
      const extractTemp: string = await lib.extractTar(temp);
      lib.prependPath(path.join(extractTemp, "pulumi"));
      tl.debug(tl.loc("Debug_Installed"));
      tl.debug(tl.loc("Debug_AddedToPATH"));
    } catch (err) {
      tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiInstallFailed", err.message));
    }
  }
}
