// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";

export interface IServiceEndpoint {
    subscriptionId: string;
    servicePrincipalKey: string;
    tenantId: string;
    clientId: string;
}

export function getServiceEndpoint(
    connectedServiceName: string
): IServiceEndpoint | undefined {
    const endpointAuthorization = tl.getEndpointAuthorization(
        connectedServiceName,
        true
    );
    if (!endpointAuthorization) {
        return undefined;
    }

    const endpoint = {
        clientId: tl.getEndpointAuthorizationParameter(
            connectedServiceName,
            "serviceprincipalid",
            false
        ),
        servicePrincipalKey: tl.getEndpointAuthorizationParameter(
            connectedServiceName,
            "serviceprincipalkey",
            false
        ),
        // It is entirely possible subscriptionId is not present, so setting subscription as optional stops an unintended failure.
        // eg- a ManagementGroup scoped SP has access to multiple subscriptions; the subscription that is the target of a pulumi up will be enforced in the pulumi program config/env.
        subscriptionId: tl.getEndpointDataParameter(
            connectedServiceName,
            "subscriptionid",
            true
        ),
        tenantId: tl.getEndpointAuthorizationParameter(
            connectedServiceName,
            "tenantid",
            false
        ),
    } as IServiceEndpoint;

    return endpoint;
}
// 500-1000 per tenant
