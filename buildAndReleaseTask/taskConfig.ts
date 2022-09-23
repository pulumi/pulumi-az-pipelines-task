import * as tl from "azure-pipelines-task-lib/task";

/**
 * Represents this task's inputs as modeled in the task
 * manifest file `task.json`.
 */
export interface TaskConfig {
    // Inputs that are not strictly required
    // task should be marked as optional here.
    // But if a certain input is required because
    // a dependent input was provided, you should
    // still mark the input as optional here
    // and assert the value at the place of
    // its use.
    azureSubscription?: string;
    command?: string;
    loginArgs?: string;
    args?: string;
    cwd?: string;
    stack?: string;
    versionSpec?: string;
    createStack?: boolean;
    createPrComment?: boolean;
    useThreadedPrComments?: boolean;
}

/**
 * Returns this task's inputs.
 */
export function getTaskConfig(): TaskConfig {
    return {
        azureSubscription: tl.getInput("azureSubscription"),
        command: tl.getInput("command"),
        loginArgs: tl.getInput("loginArgs"),
        args: tl.getInput("args"),
        cwd: tl.getInput("cwd"),
        stack: tl.getInput("stack"),
        versionSpec: tl.getInput("versionSpec"),
        createStack: tl.getBoolInput("createStack"),
        createPrComment: tl.getBoolInput("createPrComment"),
        useThreadedPrComments: tl.getBoolInput("useThreadedPrComments"),
    };
}
