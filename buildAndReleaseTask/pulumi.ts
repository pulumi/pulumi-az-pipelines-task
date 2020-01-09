// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";

import { getServiceEndpoint } from "./serviceEndpoint";
import { PULUMI_ACCESS_TOKEN } from "./vars";

interface IEnvMap { [key: string]: string; }

async function selectStack(toolPath: string, pulExecOptions: tr.IExecOptions) {
    const pulStack = tl.getInput("stack", true);
    const exitCode = await tl.exec(toolPath, ["stack", "select", pulStack], pulExecOptions);
    if (exitCode !== 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiStackSelectFailed", pulStack));
        return;
    }
}

function appendArgsToToolCmd(cmdRunner: tr.ToolRunner, args: string[]): tr.ToolRunner {
    args.forEach((arg: string) => {
        cmdRunner.arg(arg);
    });
    return cmdRunner;
}

async function runPulumiCmd(toolPath: string, pulExecOptions: tr.IExecOptions) {
    const pulCommand = tl.getInput("command", true);
    if (!pulCommand) {
        return;
    }
    const pulArgs = tl.getDelimitedInput("args", " ");
    let pulCommandRunner = tl.tool(toolPath).arg(pulCommand);
    pulCommandRunner = appendArgsToToolCmd(pulCommandRunner, pulArgs);
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
 * Returns all variables available to this task.
 */
function tryGetEnvVars(): IEnvMap {
    const vars: IEnvMap = {};
    tl.getVariables().forEach((vi) => {
        vars[vi.name] = vi.value;
    });

    return vars;
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

        const agentEnvVars = tryGetEnvVars();
        const azureServiceEndpointEnvVars = tryGetAzureEnvVarsFromServiceEndpoint();
        const loginEnvVars = {
            ...azureServiceEndpointEnvVars,
            ...agentEnvVars,
        };

        const azureStorageContainer = agentEnvVars["AZURE_STORAGE_CONTAINER"];
        const loginArgs = tl.getDelimitedInput("loginArgs", " ");
        // Login and then run the command.
        tl.debug(tl.loc("Debug_Login"));
        // For backward compatibility, also check for `pulumi.access.token`
        // and manually set the access token env var for the login command.
        const pulumiAccessToken =
            tl.getVariable("pulumi.access.token") ||
            // `getVariable` will automatically prepend the SECRET_ prefix if it finds
            // it in the build environment's secret vault.
            tl.getVariable("PULUMI_ACCESS_TOKEN");
        if (!azureStorageContainer && !pulumiAccessToken && loginArgs.length === 0) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiLoginUndetermined"));
            return;
        }

        let loginCommand = ["login"];
        if (azureStorageContainer) {
            loginCommand = ["login", "-c", `azblob://${azureStorageContainer}`];
        }  else if (pulumiAccessToken) {
            loginEnvVars[PULUMI_ACCESS_TOKEN] = pulumiAccessToken;
        }

        let loginCmdRunner = tl.tool(toolPath).arg(loginCommand);
        loginCmdRunner = appendArgsToToolCmd(loginCmdRunner, loginArgs);
        const exitCode = await loginCmdRunner.exec(getExecOptions(loginEnvVars, ""));
        if (exitCode !== 0) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiLoginFailed"));
            return;
        }

        /**
         * `process.env` only contains "public" variables, i.e. system and agent variables that
         * are not secret. Secret vars can only be retrieved using `tl.getVariable` or
         * `tl.getVariables`.
         */
        const processEnv = process.env as IEnvMap;
        tl.debug(`Executing Pulumi commands with process env ${JSON.stringify(processEnv)}`);
        const envVars: IEnvMap = {
            ...azureServiceEndpointEnvVars,
            ...agentEnvVars,
            ...processEnv,
        };

        /**
         * For DotNet projects, the dotnet CLI requires a home directory (sort of a temp directory).
         * On Azure Pipelines, the user home env var is undefined, and the workaround is to
         * set the DOTNET_CLI_HOME env var. This is not a Pulumi-specfic env var.
         */
        const dotnetCliHome =
            tl.getVariable("dotnet.cli.home") ||
            tl.getVariable("DOTNET_CLI_HOME") ||
            tl.getVariable("Agent.TempDirectory") ||
            "";
        envVars["DOTNET_CLI_HOME"] = dotnetCliHome;
        // Get the working directory where the Pulumi commands must be run.
        const pulCwd = tl.getInput("cwd") || ".";
        const pulExecOptions = getExecOptions(envVars, pulCwd);

        // Select the stack.
        await selectStack(toolPath, pulExecOptions);

        // Get the command, and the args the user wants to pass to the Pulumi CLI.
        await runPulumiCmd(toolPath, pulExecOptions);
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}
