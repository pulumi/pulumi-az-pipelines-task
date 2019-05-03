// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as axios from "axios";
import * as tl from "azure-pipelines-task-lib/task";

export const ENV_PULUMI_VERSION = "PULUMI_VERSION";

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
    // Set the version in the env var, so that subsequent tasks know which version to check in the tool cache.
    tl.setVariable(ENV_PULUMI_VERSION, version);
    return version;
}
