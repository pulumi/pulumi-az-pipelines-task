// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

/**
 * This file contains the various environment variables set by the task extension.
 */

// INSTALLED_PULUMI_VERSION is set after a version of the CLI has been installed successfully.
export const INSTALLED_PULUMI_VERSION = "INSTALLED_PULUMI_VERSION";

// PULUMI_ACCESS_TOKEN is used by the Pulumi CLI to login into an account non-interactively.
export const PULUMI_ACCESS_TOKEN = "PULUMI_ACCESS_TOKEN";
/**
 * PULUMI_CONFIG_PASSPHRASE is used to specify the passphrase used by the secrets provider
 * to be able to decrypt a secret that was previously encrypted by deriving a key
 * from the same passphrase.
 *
 * See https://blog.pulumi.com/managing-secrets-with-pulumi to learn more about encrypted configuration properties.
 */
export const PULUMI_CONFIG_PASSPHRASE = "PULUMI_CONFIG_PASSPHRASE";

/**
 * AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY is used to login and store state in Azure Storage
 */
export const AZURE_STORAGE_ACCOUNT = "AZURE_STORAGE_ACCOUNT"
export const AZURE_STORAGE_KEY = "AZURE_STORAGE_KEY"