// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as restm from "typed-rest-client";

export async function getLatestPulumiVersion(): Promise<string> {
    const restClient = new restm.RestClient("pulumi-azure-pipelines-task");
    const resp = await restClient.get<string>("https://pulumi.io/latest-version");
    return resp.result!;
}
