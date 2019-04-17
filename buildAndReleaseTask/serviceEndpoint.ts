// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";

export interface IServiceEndpoint {
    subscriptionId: string;
    servicePrincipalKey: string;
    tenantId: string;
    clientId: string;
}

export function getServiceEndpoint(connectedServiceName: string): IServiceEndpoint {
    const endpoint = {
        clientId: tl.getEndpointAuthorizationParameter(connectedServiceName, "serviceprincipalid", true),
        servicePrincipalKey: tl.getEndpointAuthorizationParameter(connectedServiceName, "serviceprincipalkey", false),
        subscriptionId: tl.getEndpointDataParameter(connectedServiceName, "subscriptionid", true),
        tenantId: tl.getEndpointAuthorizationParameter(connectedServiceName, "tenantid", false),
    } as IServiceEndpoint;

    return endpoint;
}
