// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const uuidV4 = require("uuid/v4");

export async function installUsingPowerShell(): Promise<number> {
    let resultCode: number;
    // Listen for stderr.
    let stderrFailure = false;
    // For Windows, we'll generate an ephemeral PS script file with the necessary contents,
    // and run that as a command using PS.
    const tempDirectory = tl.getVariable("agent.tempDirectory");
    tl.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);
    const filePath = path.join(tempDirectory, uuidV4() + ".ps1");
    // Direct all output to STDOUT, otherwise the output may appear out
    // of order since Node buffers it's own STDOUT but not STDERR.
    const options = {
        cwd: tl.cwd(),
        env: {},
        errStream: process.stdout,
        failOnStdErr: false,
        ignoreReturnCode: true,
        outStream: process.stdout,
        silent: false,
        windowsVerbatimArguments: false,
    } as tr.IExecOptions;

    const contents: string[] = [];
    contents.push("$ErrorActionPreference = 'Stop'");
    // tslint:disable-next-line:max-line-length
    contents.push("\"[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; iex ((New-Object System.Net.WebClient).DownloadString(\"https://get.pulumi.com/install.ps1\'))\" && SET \"PATH=%PATH%;%USERPROFILE%\.pulumi\bin\"");
    const writeFileAsync = new Promise(((resolve, reject) => {
        fs.writeFile(
            filePath,
            // Prepend the Unicode BOM character.
            "\ufeff" + contents.join(os.EOL),
            // Since UTF8 encoding is specified, node will
            // encode the BOM into its UTF8 binary sequence.
            {
                encoding: "utf8",
            }, ((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            }));
    }));
    await writeFileAsync;

    const powershellCmd = tl.tool(tl.which("pwsh") || tl.which("powershell") || tl.which("pwsh", true))
            .arg("-NoLogo")
            .arg("-NoProfile")
            .arg("-NonInteractive")
            .arg("-ExecutionPolicy")
            .arg("Bypass")
            .arg("-Command")
            .arg(`. "${filePath.replace("'", "''")}'`);

    powershellCmd.on("stderr", (err) => {
        if (!err) {
            return;
        }
        stderrFailure = true;
    });
    resultCode = await powershellCmd.exec(options);
    // Fail on stderr.
    if (stderrFailure) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("JS_Stderr"));
        return -1;
    }

    return resultCode;
}
