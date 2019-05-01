# Pulumi Azure Pipelines Task Extension Example

Create a Pulumi account at https://app.pulumi.com/signup, and install the CLI by following instructions from https://pulumi.io/quickstart/install.html.

Then, do the following:
- Create a Git repo in your Azure DevOps project for this example.
- Then connect this folder with your git repo on DevOps.
- Once connected, you can create a project and the stack in your Pulumi account by running:
  - `pulumi stack init <org-name>/pulumi-az-pipelines-task-example/dev`, where `<org-name>` is your username or the organization's username on Pulumi.
    - The forward slash (/) between the org name and the stack name is required.
- Commit and push up this repo to your DevOps project in the `master` branch.
- After you push, a pipeline build will automatically start, which should fail. That's because you didn't set the Pulumi access token for the CLI yet.
- Read the next section to learn how to do that.

## Pulumi Access Token

The Pulumi CLI will need an access token in order to login non-interactively in the Azure Pipelines agent.

- To get an access token, go to https://app.pulumi.com/account/tokens and create a new access token.
  - Save the value shown somewhere safe. This value will not be shown to you again.
- Now, navigate to the **Pipelines** tab on Azure DevOps, and click on **Edit**.
- Click the overflow icon (three dots) next to the **Run** button and select **Variables**.
- Create a new variable with the name `pulumi.access.token` and paste the value you copied from the first step.
- **Important!** Click the padlock icon to change the variable type to secret, so that it is encrypted at rest. Your Pulumi access token is a sensitive value.
- Click on the **Save & queue** dropdown button, and click **Save**.

You can now queue a new build by clicking on `Queue`, and following the on-screen prompts.

## Got Questions?

Join us on Slack at https://slack.pulumi.io.
