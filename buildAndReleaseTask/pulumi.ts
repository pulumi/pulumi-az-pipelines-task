// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";

import { getServiceEndpoint } from "./serviceEndpoint";
import { PULUMI_ACCESS_TOKEN } from "./vars";

interface IEnvMap { [key: string]: string; }

interface IExecResult {
    exitCode: number;
    execErr?: string;
}

async function runSelectStack(
    pulStack: string,
    toolPath: string,
    pulExecOptions: tr.IExecOptions): Promise<IExecResult> {
    const stackSelectRunner = tl.tool(toolPath);
    let execErr = "";
    // The toolrunner emits an event when there is an error written to the stderr.
    // Listen for that event and update the execution error message accordingly.
    stackSelectRunner.on("stderr", (errLine: string) => execErr = errLine);

    const exitCode = await stackSelectRunner.arg(["stack", "select", pulStack!]).exec(pulExecOptions);
    return { exitCode, execErr };
}

/**
 * Selects the stack specified as input to this task. If the selection command
 * fails, then creates the stack if the `createStack` task input is `true`,
 * IFF the stack selection failure was due to the stack not being found.
 */
async function selectOrCreateStack(toolPath: string, pulExecOptions: tr.IExecOptions): Promise<number> {
    const pulStack = tl.getInput("stack", true);
    const selectStackExecResult = await runSelectStack(pulStack!, toolPath, pulExecOptions);
    if (selectStackExecResult.exitCode === 0) {
        return 0;
    }

    // Check if the user requested to create the stack if it does not exist.
    const createStack = tl.getBoolInput("createStack");
    if (!createStack) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiStackSelectFailed", pulStack));
        return selectStackExecResult.exitCode;
    }

    // Check if the error was because the stack was not found.
    const errMsg = `no stack named '${pulStack}' found`;
    if (!selectStackExecResult.execErr!.includes(errMsg)) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiStackSelectFailed", pulStack));
        return selectStackExecResult.exitCode;
    }

    tl.debug(tl.loc("Debug_CreateStack", pulStack));
    const stackInitRunner = tl.tool(toolPath);
    const exitCode = await stackInitRunner.arg(["stack", "init", pulStack!]).exec(pulExecOptions);
    if (exitCode !== 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("CreateStackFailed", pulStack));
    }
    return exitCode;
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

/**
 * Runs the Pulumi command provided as input to this task.
 * Before running the command itself, this function determines
 * the login mechanism for this operation, i.e., detecting if
 * `PULUMI_ACCESS_TOKEN` is specified or if the `loginArgs` input
 * was provided by the user to use an alternate backend for the command.
 *
 * Pulumi commands are run against a specific stack and so,
 * this function will try to select it, or create it based on
 * the `createStack` user input.
 */
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
        const stackCmdExitCode = await selectOrCreateStack(toolPath, pulExecOptions);
        if (stackCmdExitCode !== 0) {
            return;
        }

        // Get the command, and the args the user wants to pass to the Pulumi CLI.
        await runPulumiCmd(toolPath, pulExecOptions);
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}
