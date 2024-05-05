// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import { getHandlerFromToken, WebApi } from "azure-devops-node-api";
import { ITaskApi } from "azure-devops-node-api/TaskApi";
import * as tl from "azure-pipelines-task-lib/task";
import { getSystemAccessToken } from "azure-pipelines-tasks-artifacts-common/webapi";

export interface IServiceEndpoint {
    subscriptionId: string;
    oidcToken?: string;
    servicePrincipalKey?: string;
    tenantId: string;
    clientId: string;
}

export async function getServiceEndpoint(
    connectedServiceName: string
): Promise<IServiceEndpoint | undefined> {
    const endpointAuthorization = tl.getEndpointAuthorization(
        connectedServiceName,
        true
    );
    if (!endpointAuthorization) {
        return undefined;
    }

    const oidcEndpoint = await tryGetOidcServiceEndpoint(connectedServiceName);
    if (oidcEndpoint) {
        return oidcEndpoint;
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

/**
 * Tries to get the endpoint details for a workload identity federation
 * service connection as per V2 of the Azure CLI task
 * https://github.com/microsoft/azure-pipelines-tasks/blob/master/Tasks/AzureCLIV2/azureclitask.ts#L143-L152
 */
async function tryGetOidcServiceEndpoint(
    connectedServiceName: string
): Promise<IServiceEndpoint | undefined> {
    const authScheme = tl.getEndpointAuthorizationScheme(
        connectedServiceName,
        true
    );
    tl.debug(`Service endpoint authorization scheme ${authScheme ?? ""}`);
    if (authScheme?.toLowerCase() !== "workloadidentityfederation") {
        return undefined;
    }

    const federatedToken = await tryGetIdToken(connectedServiceName);

    if (!federatedToken) {
        return undefined;
    }

    tl.setSecret(federatedToken);

    const endpoint = {
        clientId: tl.getEndpointAuthorizationParameter(
            connectedServiceName,
            "serviceprincipalid",
            false
        ),
        oidcToken: federatedToken,
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

/**
 * Tries to get the ID token as per V2 of the Azure CLI task
 * https://github.com/microsoft/azure-pipelines-tasks/blob/master/Tasks/AzureCLIV2/azureclitask.ts#L251-L268
 */
async function tryGetIdToken(
    connectedService: string
): Promise<string | undefined | null> {
    const jobId = tl.getVariable("System.JobId")!;
    const planId = tl.getVariable("System.PlanId")!;
    const projectId = tl.getVariable("System.TeamProjectId")!;
    const hub = tl.getVariable("System.HostType")!;
    const uri = tl.getVariable("System.CollectionUri")!;
    const token = getSystemAccessToken();

    const authHandler = getHandlerFromToken(token);
    const connection = new WebApi(uri, authHandler);
    const api: ITaskApi = await connection.getTaskApi();
    const response = await api.createOidcToken(
        {},
        projectId,
        hub,
        planId,
        jobId,
        connectedService
    );
    if (response == null) {
        return null;
    }

    return response.oidcToken;
}
// 500-1000 per tenant
