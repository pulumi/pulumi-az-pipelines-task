[![Build Status](https://dev.azure.com/pulumi/Pulumi%20Azure%20Pipelines%20Task/_apis/build/status/pulumi.pulumi-az-pipelines-task?branchName=master)](https://dev.azure.com/pulumi/Pulumi%20Azure%20Pipelines%20Task/_build/latest?definitionId=1&branchName=master)

# Pulumi Azure task extension for Azure Pipelines

## Release status

This project is in private preview. **Do not make this repo public yet!**

## Prerequisites

- Node (>= 8.x)
- Yarn (>= 1.13.0)
- tslint (`npm i -g tslint`)
- typescript compiler (`npm i -g typescript`)

## Local Development

- Set the `AGENT_TOOLSDIRECTORY` env var to any directory for caching the pulumi tool.
- `npm install` in the `buildAndReleaseTask` and the `buildAndReleaseTask/tests` folders.
- You can run the tool either from the root directory or the `buildAndReleaseTask` directory.
  - To run from the root folder, simply run `npm start`.
  - To run from the `buildAndReleaseTask` folder, run `tsc && node index.js` from the `buildAndReleaseTask` directory.

## Tests

`npm run test`

## Package

> Learn more [here](https://docs.microsoft.com/en-us/azure/devops/extend/develop/add-build-task?view=azure-devops#step-4-package-your-extension).

- Ensure you have `tfx` cli installed by running `tfx version`. If it is not installed, then run `npm i -g tfx-cli`.
- Install `vsts-bump` by running `npm i -g vsts-bump`.
- Run `npm run package` from the root directory.
