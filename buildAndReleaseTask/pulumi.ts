// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";

import { getServiceEndpoint } from "./serviceEndpoint";
import { PULUMI_ACCESS_TOKEN, PULUMI_CONFIG_PASSPHRASE, AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY } from "./vars";

interface IEnvMap { [key: string]: string; }

async function selectStack(toolPath: string, pulExecOptions: tr.IExecOptions) {
    const pulStack = tl.getInput("stack", true);
    const exitCode = await tl.exec(toolPath, ["stack", "select", pulStack], pulExecOptions);
    if (exitCode !== 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiStackSelectFailed", pulStack));
        return;
    }
}

async function runPulumiCmd(toolPath: string, pulExecOptions: tr.IExecOptions) {
    const pulCommand = tl.getInput("command", true);
    const pulCommandRunner = tl.tool(toolPath).arg(pulCommand);
    const pulArgs = tl.getDelimitedInput("args", " ");
    pulArgs.forEach((arg: string) => {
        pulCommandRunner.arg(arg);
    });
    const exitCode = await pulCommandRunner.exec(pulExecOptions);
    if (exitCode !== 0) {
        tl.setResult(tl.TaskResult.Failed,
            tl.loc("PulumiCommandFailed", exitCode, `${pulCommand} ${pulArgs.join(" ")}`));
        return;
    }
}

function getExecOptions(envMap: IEnvMap, workingDirectory: string): tr.IExecOptions {
    return {
        cwd: workingDirectory,
        env: envMap,

        // Set defaults.
        errStream: process.stderr,
        failOnStdErr: false,
        ignoreReturnCode: true,
        outStream: process.stdout,
        silent: false,
        windowsVerbatimArguments: false,
    } as tr.IExecOptions;
}

/**
 * If the `serviceEndpoint` param is not `undefined`, then
 * this function returns an env var map with the `ARM_*`
 * env vars.
 */
function tryGetAzureEnvVarsFromServiceEndpoint(): IEnvMap {
    const connectedServiceName = tl.getInput("azureSubscription", false);
    if (!connectedServiceName) {
        return {};
    }
    tl.debug(tl.loc("Debug_ServiceEndpointName", connectedServiceName));

    const serviceEndpoint = getServiceEndpoint(connectedServiceName);
    if (serviceEndpoint) {
        tl.debug(`Service endpoint retrieved with client ID ${serviceEndpoint.clientId}`);
    }
    if (!serviceEndpoint) {
        return {};
    }

    return {
        ARM_CLIENT_ID: serviceEndpoint.clientId,
        ARM_CLIENT_SECRET: serviceEndpoint.servicePrincipalKey,
        ARM_SUBSCRIPTION_ID: serviceEndpoint.subscriptionId,
        ARM_TENANT_ID: serviceEndpoint.tenantId,
    };
}

/**
 * Tries to fetch the AWS Access Key ID and Secret Access Key from
 * the build environment and returns an env var map with the
 * AWS_* env vars.
 */
function tryGetAwsEnvVars(): IEnvMap {
    const awsVars: IEnvMap = {};
    const vars = [
        "AWS_ACCESS_KEY_ID",
        "AWS_REGION",
        "AWS_PROFILE",
    ];
    const secretVars = [
        "AWS_SECRET_ACCESS_KEY",
    ];

    vars.forEach((varName: string) => {
        let val = tl.getVariable(varName);
        if (!val) {
            // ADO will automatically prepend the VSTS_TASKVARIABLE prefix to non-secret
            // build variables. So let's try to fetch the variable with that.
            val = tl.getVariable(`VSTS_TASKVARIABLE_${varName}`);
        }
        if (!val) {
            return;
        }
        awsVars[varName] = val;
    });

    secretVars.forEach((secretVar: string) => {
        let val = tl.getVariable(secretVar);
        if (!val) {
            // `getVariable` will automatically prepend the SECRET_ prefix if it finds
            // it in the build environment's secret vault, but we will also try to fetch
            // it explicitly with the prefix.
            val = tl.getVariable(`SECRET_${secretVar}`);
        }
        if (!val) {
            return;
        }
        awsVars[secretVar] = val;
    });

    return {
        ...awsVars,
    };
}

export async function runPulumi() {
    try {
        // Print the version.
        const toolPath = tl.which("pulumi");
        tl.debug(tl.loc("Debug_PrintToolPath", toolPath));
        if (!toolPath) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiNotFound"));
            return;
        }
        tl.debug(tl.loc("Debug_PrintingVersion"));
        await tl.exec(toolPath, "version");

        // Login and then run the command.
        tl.debug(tl.loc("Debug_Login"));
        const pulumiAccessToken =
            tl.getVariable("pulumi.access.token") ||
            // `getVariable` will automatically prepend the SECRET_ prefix if it finds
            // it in the build environment's secret vault.
            tl.getVariable("PULUMI_ACCESS_TOKEN") ||
            tl.getVariable("SECRET_PULUMI_ACCESS_TOKEN");
        if (!pulumiAccessToken) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiAccessTokenNotFailed"));
            return;
        }

        const azureStorageContainer = 
            tl.getVariable("azure.storage.container") ||
            tl.getVariable("AZURE_STORAGE_CONTAINER") ||
            tl.getVariable("SECRET_AZURE_STORAGE_CONTAINER");

        const azureStorageAccount = 
            tl.getVariable("azure.storage.account") ||
            tl.getVariable("AZURE_STORAGE_ACCOUNT") ||
            tl.getVariable("SECRET_AZURE_STORAGE_ACCOUNT");

        const azureStorageKey = 
            tl.getVariable("azure.storage.key") ||
            tl.getVariable("AZURE_STORAGE_KEY") ||
            tl.getVariable("SECRET_AZURE_STORAGE_KEY");

        const loginCmdEnvVars: { [key: string]: string } = {};
        let useAzureStorage = !(!azureStorageContainer && !azureStorageAccount && !azureStorageKey);
        var loginCommand = ["login"];

        if (useAzureStorage) {
            loginCmdEnvVars[AZURE_STORAGE_ACCOUNT] = pulumiAccessToken;
            loginCmdEnvVars[AZURE_STORAGE_KEY] = pulumiAccessToken;
            loginCommand = ["login","-c", "azblob://"+azureStorageContainer];
        } else {
            loginCmdEnvVars[PULUMI_ACCESS_TOKEN] = pulumiAccessToken;
        }

        const exitCode = await tl.tool(toolPath)
        .arg(loginCommand)
        .exec(getExecOptions(loginCmdEnvVars, ""));
        if (exitCode !== 0) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiLoginFailed"));
            return;
        }

        // Get the working directory where the Pulumi commands must be run.
        const pathEnv = process.env["PATH"];
        tl.debug(`Executing Pulumi commands with PATH ${pathEnv}`);
        const pulCwd = tl.getInput("cwd") || ".";

        const envVars: IEnvMap = {
            ...tryGetAzureEnvVarsFromServiceEndpoint(),
            ...tryGetAwsEnvVars(),
            PATH: pathEnv || "",
        };

        const pulumiConfigPassphrase =
            tl.getVariable("pulumi.config.passphrase") ||
            tl.getVariable("PULUMI_CONFIG_PASSPHRASE") ||
            tl.getVariable("SECRET_PULUMI_CONFIG_PASSPHRASE") ||
            "";
        envVars[PULUMI_CONFIG_PASSPHRASE] = pulumiConfigPassphrase;
        const dotnetCliHome =
            tl.getVariable("dotnet.cli.home") ||
            tl.getVariable("DOTNET_CLI_HOME") ||
            tl.getVariable("Agent.TempDirectory") ||
            "";
        envVars["DOTNET_CLI_HOME"] = dotnetCliHome;
        const pulExecOptions = getExecOptions(envVars, pulCwd);

        // Select the stack.
        await selectStack(toolPath, pulExecOptions);

        // Get the command, and the args the user wants to pass to the Pulumi CLI.
        await runPulumiCmd(toolPath, pulExecOptions);
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}
