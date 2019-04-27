// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as tmrm from "azure-pipelines-task-lib/mock-run";
import * as path from "path";

const taskPath = path.join(__dirname, "..", "index.js");
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput("samplestring", "bad");

tmr.run();
