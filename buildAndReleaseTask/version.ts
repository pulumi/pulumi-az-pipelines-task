// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as axios from "axios";
import * as tl from "azure-pipelines-task-lib/task";

export async function getLatestPulumiVersion(): Promise<string> {
    const resp = await axios.default.get<string>("https://pulumi.io/latest-version", {
        headers: {
            "Content-Type": "text/plain",
            "User-Agent": "pulumi-azure-pipelines-task",
        },
    });
    // The response contains a new-line character at the end, so let's replace it.
    const version = resp.data.replace("\n", "");
    tl.debug(tl.loc("Debug_LatestPulumiVersion", version));
    return "0.17.5";
}
