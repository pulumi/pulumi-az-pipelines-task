// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as assert from "assert";
import * as ttm from "azure-pipelines-task-lib/mock-test";
import * as path from "path";

describe("Pulumi task tests", () => {

    it("should succeed with simple inputs", (done: MochaDone) => {

        const tp = path.join(__dirname, "success.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        console.log(tr.succeeded);
        assert.equal(tr.succeeded, true, "should have succeeded");
        assert.equal(tr.warningIssues.length, 0, "should have no warnings");
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        console.log(tr.stdout);
        assert.equal(tr.stdout.indexOf("Pulumi installed via curl") >= 0, true, "should install using curl");
        assert.equal(tr.stdout.indexOf("0.17.5") >= 0, true, "should execute `pulumi version` command");
        assert.equal(tr.stdout.indexOf("stack selected") >= 0, true, "should select stack");
        assert.equal(tr.stdout.indexOf("fake logged in") >= 0, true, "should login");
        assert.equal(tr.stdout.indexOf("fake pulumi preview") >= 0, true, "should execute `pulumi preview` command");
        done();
    });

    // it("it should fail if tool returns 1", (done: MochaDone) => {
    //     this.timeout(1000);

    //     let tp = path.join(__dirname, "failure.js");
    //     let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    //     tr.run();
    //     console.log(tr.succeeded);
    //     assert.equal(tr.succeeded, false, "should have failed");
    //     assert.equal(tr.warningIssues, 0, "should have no warnings");
    //     assert.equal(tr.errorIssues.length, 1, "should have 1 error issue");
    //     assert.equal(tr.errorIssues[0], "Bad input was given", "error issue output");
    //     assert.equal(tr.stdout.indexOf("Hello bad"), -1, "Should not display Hello bad");

    //     done();
    // });
});
