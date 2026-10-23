import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const workflow = readFileSync(new URL("../../.github/workflows/preview.yml", import.meta.url), "utf8");

function eligible(job, action, author, headRepo, actor = author) {
  const block = workflow.split(`  ${job}:\n`)[1]?.split(/\n  \w+:\n/)[0];
  const condition = block?.match(/    if: >-\n((?:      .+\n)+)/)?.[1];
  assert.ok(condition, `missing eligibility condition for ${job}`);
  return runInNewContext(condition.trim(), {
    github: {
      actor,
      repository: "sinequix/enrailar",
      event: { action, pull_request: { user: { login: author }, head: { repo: { full_name: headRepo } } } },
    },
  }, { timeout: 100 });
}

test("internal PRs deploy on updates and clean up only when closed", () => {
  for (const action of ["opened", "synchronize", "reopened", "closed"]) {
    assert.equal(eligible("deploy", action, "maintainer", "sinequix/enrailar"), action !== "closed");
    assert.equal(eligible("destroy", action, "maintainer", "sinequix/enrailar"), action === "closed");
  }
});

test("secretless PRs never enter either privileged job, including human reruns", () => {
  for (const action of ["opened", "synchronize", "reopened", "closed"]) {
    for (const job of ["deploy", "destroy"]) {
      assert.equal(eligible(job, action, "dependabot[bot]", "sinequix/enrailar"), false);
      assert.equal(eligible(job, action, "dependabot[bot]", "sinequix/enrailar", "maintainer"), false);
      assert.equal(eligible(job, action, "contributor", "contributor/enrailar"), false);
      assert.equal(eligible(job, action, "contributor", "contributor/enrailar", "maintainer"), false);
    }
  }
});
