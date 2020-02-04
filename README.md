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
- To manage your new publisher account, you can visit `https://marketplace.visualstudio.com/manage/publishers/{your_publisher_account_name}`.

#### Updating the manifest files

- In the `vss-extension.json` file, modify the value of the `name` property to something unique.
- **IMPORTANT:** Change the value of the property `galleryFlags` to `Private` instead of `Public`.
  - Tip: Maybe give it a suffix or a prefix that clearly identifies it as your private build.
- Now in the `buildAndReleaseTask/task.json`, change the value of the `id` property to a unique value. You can get a new, unique value from https://www.guidgen.com.
- Change the value of the `name` property to something unique in this file as well.
  - This is the name you will see in the Azure Pipelines build when you add it as a task.
- **IMPORTANT:** Change the value of the `author` property to be _your_ new publisher account name.

#### Generate a private package

- From the root of the project directory, run `npm run package`. This will bump the version number and produce a new package with the `.vsix` file extension.
- Go to your publisher account page, `https://marketplace.visualstudio.com/manage/publishers/{your_publisher_account_name}` (be sure to replace `{your_publisher_account_name}` with the actual value), and click on **New Extension** > **Azure DevOps** and drag/drop the VSIX file you generated in the previous step.
- Follow the on-screen instructions (if any). Now you are ready to share the private build with your organization.

#### Share the private build with your organization

- Once the package upload is complete, you can click on the options icon (the `...` button) and click on **Share/Unshare**.
- Click on **+ Organization** to add your newly-created DevOps organization.

#### Installing the private build

- Finally, you can now head over to your organization and install the extension that has been shared with it.
- Go to the root of your organization, `https://dev.azure.com`, and click on the **Organization Settings** button in the bottom-left corner.
- Then click on **Extensions** and then click on the **Shared** tab. You should see your private extension.
- Click on the install button and follow the instructions to complete installing it.

Once installed, return to your organization and create a new Azure Pipelines build and you should now see the newly installed private build of the task extension.

#### Uploading new versions of the private build

- To continue testing your private build of the task extension, you can simply run `npm run package` in the root of this project, and then upload a new build to your publisher account.
- Once uploaded, any Azure Pipelines build agents using it will automatically pick up the new version in a few minutes.

#### Completing your testing

- Once your testing is complete, you must revert the changes you made to the `vss-extension.json` and `task.json` as part of generating your private build. However, any other changes you made to those files, that is relevant to any Pull Request you decide to submit can remain intact.

## Package

> Learn more [here](https://docs.microsoft.com/en-us/azure/devops/extend/develop/add-build-task?view=azure-devops#step-4-package-your-extension).

- Ensure you have `tfx` cli installed by running `tfx version`. If it is not installed, then run `npm i -g tfx-cli`.
- Install `vsts-bump` by running `npm i -g vsts-bump`.
- Run `npm run package` from the root directory.
