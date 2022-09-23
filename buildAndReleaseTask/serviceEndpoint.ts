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
        subscriptionId: tl.getEndpointDataParameter(
            connectedServiceName,
            "subscriptionid",
            false
        ),
        tenantId: tl.getEndpointAuthorizationParameter(
            connectedServiceName,
            "tenantid",
            false
        ),
    } as IServiceEndpoint;

    return endpoint;
}
