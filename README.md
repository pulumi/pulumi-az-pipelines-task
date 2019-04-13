# Pulumi Azure RM Task for Azure Pipelines

## Prerequisites

- Node (>= 8.x)
- Yarn (>= 1.13.0)
- tslint (`npm i -g tslint`)
- typescript compiler (`npm i -g typescript`)

## Local Development

- Set the `AGENT_TOOLSDIRECTORY` env var to any directory for caching the pulumi tool.
- Run `tsc && node index.js` from the `buildAndReleaseTask` directory.

## Package

> Learn more [here](https://docs.microsoft.com/en-us/azure/devops/extend/develop/add-build-task?view=azure-devops#step-4-package-your-extension).

Ensure you have `tfx` cli installed by running `tfx version`. If it is not installed, then run `npm i -g tfx-cli`.

`tfx extension create --manifest-globs vss-extension.json --rev-version`
