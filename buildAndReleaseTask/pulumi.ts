// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import { createWriteStream, unlinkSync, WriteStream } from "fs";
import { join as pathJoin } from "path";

import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";

import { getServiceEndpoint } from "./serviceEndpoint";
import { INSTALLED_PULUMI_VERSION, PULUMI_ACCESS_TOKEN } from "./vars";

import { gt as semverGt } from "semver";
import { TaskConfig } from "taskConfig";

import { createPrComment, PULUMI_LOG_FILENAME } from "./prComment";

interface IEnvMap { [key: string]: string; }

interface IExecResult {
    exitCode: number;
    execErr?: string;
}

function cliVersionGreaterThan(version: string): boolean {
    const installedCliVersion = tl.getVariable(INSTALLED_PULUMI_VERSION);
    if (!installedCliVersion) {
        // We always set the installed version when the task starts,
        // so we shouldn't hit this ever.
        return false;
    }

    return semverGt(installedCliVersion, version);
}

async function runSelectStack(
    pulStack: string,
    toolPath: string,
    pulExecOptions: tr.IExecOptions,
    additionalArgs?: string[],): Promise<IExecResult> {
    const stackSelectRunner = tl.tool(toolPath);
    let execErr = "";
    // The toolrunner emits an event when there is an error written to the stderr.
    // Listen for that event and update the execution error message accordingly.
    stackSelectRunner.on("stderr", (errLine: string) => execErr = errLine);

    let cmd = stackSelectRunner.arg(["stack", "select", pulStack!]);
    if (additionalArgs) {
        cmd = appendArgsToToolCmd(cmd, additionalArgs);
    }
    const exitCode = await cmd.exec(pulExecOptions);
    return { exitCode, execErr };
}

/**
 * Selects the stack specified as input to this task. If the selection command
 * fails, then creates the stack if the `createStack` task input is `true`,
 * IFF the stack selection failure was due to the stack not being found.
 */
async function selectOrCreateStack(taskConfig: TaskConfig, toolPath: string, pulExecOptions: tr.IExecOptions): Promise<number> {
    const createStack = taskConfig.createStack;
    const pulStackFqdn = taskConfig.stack;
    if (!pulStackFqdn) {
        throw new Error("Stack name is required");
    }

    let selectStackExecResult: IExecResult;
    if (createStack && cliVersionGreaterThan("1.10.0")) {
        // The `-c` flag was added in 1.10.0. Hopefully, no one is using that old of a CLI anymore.
        // But we still should make sure we don't try to use that flag on older versions.
        selectStackExecResult = await runSelectStack(pulStackFqdn, toolPath, pulExecOptions, ["-c"]);
    } else {
        selectStackExecResult = await runSelectStack(pulStackFqdn, toolPath, pulExecOptions);
    }
    if (selectStackExecResult.exitCode === 0) {
        return 0;
    }

    // If the user did not request to create the stack, we won't even
    // check if the failure was due to the stack not being found, just
    // fail right away.
    if (!createStack) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiStackSelectFailed", pulStackFqdn));
        return selectStackExecResult.exitCode;
    }

    // Check if the error was because the stack was not found and create it.
    // At this point in the flow, it means we are on an old version of the CLI
    // that doen't support the new `-c` flag that would have auto-created the
    // stack if it didn't exist.
    const parts = pulStackFqdn!.split("/");
    const errMsg = `no stack named '${parts[parts.length - 1]}' found`;
    if (!selectStackExecResult.execErr!.includes(errMsg)) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiStackSelectFailed", pulStackFqdn));
        return selectStackExecResult.exitCode;
    }

    tl.debug(tl.loc("Debug_CreateStack", pulStackFqdn));
    const stackInitRunner = tl.tool(toolPath);
    const exitCode = await stackInitRunner.arg(["stack", "init", pulStackFqdn!]).exec(pulExecOptions);
    if (exitCode !== 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("CreateStackFailed", pulStackFqdn));
    }
    return exitCode;
}

function appendArgsToToolCmd(cmdRunner: tr.ToolRunner, args: string[]): tr.ToolRunner {
    args.forEach((arg: string) => {
        cmdRunner.arg(arg);
    });
    return cmdRunner;
}

async function runPulumiCmd(taskConfig: TaskConfig, toolPath: string, pulExecOptions: tr.IExecOptions) {
    const pulCommand = taskConfig.command;
    if (!pulCommand) {
        throw new Error("Pulumi command is required");
    }

    const pulArgs = tl.getDelimitedInput("args", " ");
    let pulCommandRunner = tl.tool(toolPath).arg(pulCommand);
    pulCommandRunner = appendArgsToToolCmd(pulCommandRunner, pulArgs);

    const shouldCreatePrComment = taskConfig.createPrComment;
    const logFilePath = pathJoin(".", PULUMI_LOG_FILENAME);
    let logFile: WriteStream | undefined;
    if (shouldCreatePrComment) {
        tl.debug(tl.loc("Debug_WritePulumiLog"));

        logFile = createWriteStream(logFilePath);
        pulCommandRunner.on("stdout", (data: Buffer) => {
           logFile?.write(data);
        });
    }

    const exitCode = await pulCommandRunner.exec(pulExecOptions);

    if (shouldCreatePrComment) {
        logFile?.close();
        await createPrComment(taskConfig);
        unlinkSync(logFilePath);
    }

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

        // Define the ARM credentials that the official Azure SDK for Go looks for.
        // These env vars will be required for users using the KeyVault secrets provider or an
        // Azure Storage-based backend for state persistence.
        // https://docs.microsoft.com/en-us/azure/developer/go/azure-sdk-authorization#use-environment-based-authentication
        AZURE_CLIENT_ID: serviceEndpoint.clientId,
        AZURE_CLIENT_SECRET: serviceEndpoint.servicePrincipalKey,
        AZURE_TENANT_ID: serviceEndpoint.tenantId,
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
export async function runPulumi(taskConfig: TaskConfig) {
    // `process.env` only contains "public" variables, i.e. system and agent variables that
    // are not secret. Secret vars can only be retrieved using `tl.getVariable` or
    // `tl.getVariables`.
    const processEnv = process.env as IEnvMap;
    tl.debug(`Executing Pulumi commands with process env ${JSON.stringify(processEnv)}`);

    try {
        const toolPath = tl.which("pulumi");
        const agentEnvVars = tryGetEnvVars();
        const azureServiceEndpointEnvVars = tryGetAzureEnvVarsFromServiceEndpoint();
        const loginEnvVars = {
            ...azureServiceEndpointEnvVars,
            ...agentEnvVars,
            ...processEnv,
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
            tl.getVariable(PULUMI_ACCESS_TOKEN);
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

        const envVars: IEnvMap = {
            ...azureServiceEndpointEnvVars,
            ...agentEnvVars,
            ...processEnv,
        };

        // Get the working directory where the Pulumi commands must be run.
        const pulCwd = taskConfig.cwd || ".";
        const pulExecOptions = getExecOptions(envVars, pulCwd);

        // Select the stack.
        const stackCmdExitCode = await selectOrCreateStack(taskConfig, toolPath, pulExecOptions);
        if (stackCmdExitCode !== 0) {
            return;
        }

        // Get the command, and the args the user wants to pass to the Pulumi CLI.
        await runPulumiCmd(taskConfig, toolPath, pulExecOptions);
    } catch (err: any) {
        tl.setResult(tl.TaskResult.Failed, err.toString());
    }
}
