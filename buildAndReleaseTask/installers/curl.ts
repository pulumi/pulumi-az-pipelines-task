// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";

export async function installUsingCurl(): Promise<number> {
    const curlCmd = tl.tool(tl.which("curl")).arg("-fsSL").arg("https://get.pulumi.com");
    return await curlCmd.pipeExecOutputToTool(tl.tool(tl.which("sh"))).exec();
}
