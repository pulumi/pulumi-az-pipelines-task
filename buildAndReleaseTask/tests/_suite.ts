// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as assert from "assert";
import * as ttm from "azure-pipelines-task-lib/mock-test";
import * as path from "path";

function mustNotHaveErrorsOrWarnings(tr: ttm.MockTestRunner) {
    assert.equal(tr.succeeded, true, "should have succeeded");
    assert.equal(tr.warningIssues.length, 0, "should have no warnings");
    assert.equal(tr.errorIssues.length, 0, "should have no errors");
}

describe("Pulumi task tests", () => {

    it("should install the CLI and run command", (done: MochaDone) => {
        const tp = path.join(__dirname, "success.js");
        const tr = new ttm.MockTestRunner(tp);

        tr.run();
        mustNotHaveErrorsOrWarnings(tr);
        const stdout = tr.stdout;
        // This version number should match the version number in the actual test `success.ts`.
        // The reason we are not simply exporting the const from the test and using it here is,
        // for some odd reason, doing so is causing the mock-test library to print debugging
        // output always, even when not setting the `TASK_TEST_TRACE` env var before running the test.
        const expectedVersion = "0.16.5";
        assert.equal(stdout.indexOf(expectedVersion) >= 0, true, "should execute `pulumi version` command");
        assert.equal(stdout.indexOf("stack selected") >= 0, true, "should select stack");
        assert.equal(stdout.indexOf("fake logged in") >= 0, true, "should login");
        assert.equal(stdout.indexOf("fake pulumi preview") >= 0, true, "should execute `pulumi preview` command");

        done();
    });

    it("should run Pulumi with the expected env vars", (done: MochaDone) => {
        const tp = path.join(__dirname, "envvars.js");
        const tr = new ttm.MockTestRunner(tp);

        tr.run();
        mustNotHaveErrorsOrWarnings(tr);

        done();
    });

    it("should run Pulumi with Azure Storage with the expected env vars", (done: MochaDone) => {
        const tp = path.join(__dirname, "envvars_storage.js");
        const tr = new ttm.MockTestRunner(tp);

        tr.run();
        mustNotHaveErrorsOrWarnings(tr);
        assert.equal(
            tr.stdout.indexOf("fake logged in using azure storage") >= 0,
            true,
            "should login using azure environment variables");

        done();
    });

    it("should create the stack if it does not exist", (done: MochaDone) => {
        const tp = path.join(__dirname, "create_stack_if_not_found.js");
        const tr = new ttm.MockTestRunner(tp);

        tr.run();
        mustNotHaveErrorsOrWarnings(tr);
        assert.equal(tr.stdout.indexOf("Created stack") >= 0, true, "should create stack");

        done();
    });
});
