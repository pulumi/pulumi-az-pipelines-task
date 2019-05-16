// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as assert from "assert";
import * as ttm from "azure-pipelines-task-lib/mock-test";
import * as path from "path";

describe("Pulumi task tests", () => {

    it("should succeed with simple inputs", (done: MochaDone) => {

        const tp = path.join(__dirname, "success.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.succeeded, true, "should have succeeded");
        assert.equal(tr.warningIssues.length, 0, "should have no warnings");
        assert.equal(tr.errorIssues.length, 0, "should have no errors");

        console.log(tr.stdout);
        assert.equal(tr.stdout.indexOf("0.17.8") >= 0, true, "should execute `pulumi version` command");
        assert.equal(tr.stdout.indexOf("stack selected") >= 0, true, "should select stack");
        assert.equal(tr.stdout.indexOf("fake logged in") >= 0, true, "should login");
        assert.equal(tr.stdout.indexOf("fake pulumi preview") >= 0, true, "should execute `pulumi preview` command");
        done();
    });
});
