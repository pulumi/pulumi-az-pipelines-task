# Pulumi Azure RM Task for Azure Pipelines

## Local Development

- Set the `AGENT_TOOLSDIRECTORY` env var to any directory for caching the pulumi tool.
- Run `tsc && node index.js` from the `buildAndReleaseTask` directory.
