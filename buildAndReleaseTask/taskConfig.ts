import * as tl from "azure-pipelines-task-lib/task";

import { TaskConfig } from "models";

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
