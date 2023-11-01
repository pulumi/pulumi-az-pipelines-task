import * as tl from "azure-pipelines-task-lib/task";

export interface IAWSServiceEndpoint {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    roleArn: string;
    region: string;
}

export function getAWSServiceEndpoint(
    connectedServiceName: string
): IAWSServiceEndpoint | undefined {
    const endpointAuthorization = tl.getEndpointAuthorization(
        connectedServiceName,
        true
    );
    if (!endpointAuthorization) {
        return undefined;
    }

    const endpoint = {
        accessKeyId: tl.getEndpointAuthorizationParameter(
            connectedServiceName,
            "username",
            false
        ),
        secretAccessKey: tl.getEndpointAuthorizationParameter(
            connectedServiceName,
            "password",
            false
        ),
        sessionToken: tl.getEndpointAuthorizationParameter(
            connectedServiceName,
            "sessionToken",
            true
        ),
        roleArn: tl.getEndpointAuthorizationParameter(
            connectedServiceName,
            "assumeRoleArn",
            true
        ),
        region: tl.getEndpointAuthorizationParameter(
            connectedServiceName,
            "region",
            true
        ),
    } as IAWSServiceEndpoint;

    return endpoint;
}