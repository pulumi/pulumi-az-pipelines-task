// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";

import { IServiceEndpoint } from "./serviceEndpoint";
import { PULUMI_ACCESS_TOKEN, PULUMI_CONFIG_PASSPHRASE } from "./vars";

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
    const pulCommandRunner =
        await tl.tool(toolPath)
                .arg(pulCommand);
    const pulArgs = tl.getDelimitedInput("args", " ");
    pulArgs.forEach((arg: string) => {
        pulCommandRunner.arg(arg);
    });
    const exitCode = await pulCommandRunner.exec(pulExecOptions);
    if (exitCode !== 0) {
        tl.setResult(tl.TaskResult.Failed,
            tl.loc("PulumiCommandFailed", exitCode, `${ pulCommand } ${ pulArgs.join(" ") }`));
        return;
    }
}

function getExecOptions(envMap: {[key: string]: string}, workingDirectory: string): tr.IExecOptions {
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
 * this function returns a new env var map with the `ARM_*`
 * env vars.
 */
function tryAddAzureEnvVarsFromServiceEndpoint(
    envVars: IEnvMap, serviceEndpoint?: IServiceEndpoint): IEnvMap {
        if (!serviceEndpoint) {
            return envVars;
        }

        return {
            ...envVars,
            ARM_CLIENT_ID: serviceEndpoint.clientId,
            ARM_CLIENT_SECRET: serviceEndpoint.servicePrincipalKey,
            ARM_SUBSCRIPTION_ID: serviceEndpoint.subscriptionId,
            ARM_TENANT_ID: serviceEndpoint.tenantId,
        };
}

/**
 * Tries to fetch the AWS Access Key ID and Secret Access Key from
 * the build environment and returns a new env var map with the
 * AWS env vars.
 */
function tryAddAwsEnvVars(envVars: IEnvMap): IEnvMap {
    const vars = [
        "AWS_ACCESS_KEY_ID",
        "AWS_REGION",
        "AWS_PROFILE",
    ];
    const secretVars = [
        "AWS_SECRET_ACCESS_KEY",
    ];

    const awsVars: IEnvMap = {};
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
        ...envVars,
        ...awsVars,
    };
}

export async function runPulumi(serviceEndpoint?: IServiceEndpoint) {
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

        const loginCmdEnvVars: {[key: string]: string} = {};
        loginCmdEnvVars[PULUMI_ACCESS_TOKEN] = pulumiAccessToken;
        const exitCode = await tl.tool(toolPath)
            .arg("login")
            .exec(getExecOptions(loginCmdEnvVars, ""));
        if (exitCode !== 0) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("PulumiLoginFailed"));
            return;
        }

        // Get the working directory where the Pulumi commands must be run.
        const pathEnv = process.env["PATH"];
        tl.debug(`Executing Pulumi commands with PATH ${ pathEnv }`);
        const pulCwd = tl.getInput("cwd") || ".";

        const envVars: IEnvMap = {
            PATH: pathEnv || "",
        };
        tryAddAzureEnvVarsFromServiceEndpoint(envVars, serviceEndpoint);
        tryAddAwsEnvVars(envVars);

        const pulumiConfigPassphrase =
            tl.getVariable("pulumi.config.passphrase") ||
            tl.getVariable("PULUMI_CONFIG_PASSPHRASE") ||
            tl.getVariable("SECRET_PULUMI_CONFIG_PASSPHRASE") ||
            "";
        envVars[PULUMI_CONFIG_PASSPHRASE] = pulumiConfigPassphrase;
        const pulExecOptions = getExecOptions(envVars, pulCwd);

        // Select the stack.
        await selectStack(toolPath, pulExecOptions);

        // Get the command, and the args the user wants to pass to the Pulumi CLI.
        await runPulumiCmd(toolPath, pulExecOptions);
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}
