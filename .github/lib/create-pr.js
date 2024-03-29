/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

module.exports = async ({
  github,
  branchName,
  providerName,
  prTitle,
  fullRepoName,
  mergePullRequest,
}) => {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  const url = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
  const repo = fullRepoName || `cdktf-provider-${providerName}`;
  const owner = "cdktf";

  const { data } = await github.rest.pulls.create({
    owner,
    repo,
    head: branchName,
    base: "main",
    title: prTitle || "chore(deps): upgrade provider project",
    maintainer_can_modify: true,
    body: `Triggered by ${url}`,
  });

  console.log(`Created a PR: ${data.html_url}`);

  await github.rest.issues.addLabels({
    owner,
    repo,
    issue_number: data.number,
    labels: ["automerge", "auto-approve"],
  });

  if (mergePullRequest) {
    await github.rest.pulls.merge({
      owner,
      repo,
      pull_number: data.number,
    });

    console.log(`Merged PR: ${data.html_url}`);
  }
};
