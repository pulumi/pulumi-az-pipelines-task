[![Build Status](https://dev.azure.com/pulumi/Pulumi%20Azure%20Pipelines%20Task/_apis/build/status/pulumi.pulumi-az-pipelines-task?branchName=master)](https://dev.azure.com/pulumi/Pulumi%20Azure%20Pipelines%20Task/_build/latest?definitionId=1&branchName=master)

# Pulumi Azure task extension for Azure Pipelines

## Release status

This task extension is publicly available for [free](https://marketplace.visualstudio.com/items?itemName=pulumi.build-and-release-task). You may add this extension to your DevOps organization directly from the Visual Studio Marketplace.

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

### macOS

`INPUT_AZURESUBSCRIPTION=fake-subscription-id npm run test`

### Windows

In a PowerShell window, run:

`$env:INPUT_AZURESUBSCRIPTION=fake-subscription-id`
`npm run test`

### Debug Traces

If you wish to enable detailed traces, also set `TASK_TEST_TRACE=1` before running test.

On Windows, you can do this using `$env:TASK_TEST_TRACE=1`.

### Testing in your own DevOps Organization

Sometimes unit testing alone isn't sufficient and you may want to test your changes in a real Azure DevOps organization. To do so, however, you will need to change some values in the manifest files so that you can run `npm run package` to create a VSIX package that you can install privately into your own organization. Follow these steps:

#### Prerequisites

- Signup for a free [Azure DevOps organization](https://azure.microsoft.com/en-us/services/devops/).
- Once you have created a new organization, you will need a Visual Studio Marketplace publisher account to install the extension into your newly-created organization. Click [here](https://marketplace.visualstudio.com/manage/createpublisher) to create a new publisher account.
- Now that you have created your publisher account, you are now ready to make necessary changes to the manifest files to create a private package that you can publish using your new publisher account to your own organization.

#### Updating the manifest files

- In the `vss-extension.json` file, modify the value of the `name` property to something unique.
- Change the value of the property `galleryFlags` to `Private` instead of `Public`.
  - Tip: Maybe give it a suffix or a prefix that clearly identifies it as your private build.
- Now in the `buildAndReleaseTask/task.json`, change the value of the `id` property to a unique value. You can get a new, unique value from https://www.guidgen.com.
- Change the value of the `name` property to something unique in this file as well.
  - This is the name you will see in the Azure Pipelines build when you add it as a task.
- **IMPORTANT!** Change the value of the `author` property to be _your_ new publisher account username.

## Package

> Learn more [here](https://docs.microsoft.com/en-us/azure/devops/extend/develop/add-build-task?view=azure-devops#step-4-package-your-extension).

- Ensure you have `tfx` cli installed by running `tfx version`. If it is not installed, then run `npm i -g tfx-cli`.
- Install `vsts-bump` by running `npm i -g vsts-bump`.
- Run `npm run package` from the root directory.
