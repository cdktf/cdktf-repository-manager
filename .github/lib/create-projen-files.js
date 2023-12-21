/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

module.exports = ({ providerName }) => {
  const path = require("path");
  const fs = require("fs");
  const mainFolder = path.join(process.env.GITHUB_WORKSPACE, "main");
  const provider = require(path.join(mainFolder, "provider.json"));
  const providerVersion = provider[providerName];
  const providersWithCustomRunners = require(
    path.join(mainFolder, "providersWithCustomRunners.json"),
  );
  const useCustomGithubRunner =
    providersWithCustomRunners.includes(providerName);
  const template = fs.readFileSync(
    path.join(mainFolder, "projenrc.template.js"),
    "utf-8",
  );
  const projenrc = template
    .replace("__PROVIDER__", providerVersion)
    .replace("__CUSTOM_RUNNER__", useCustomGithubRunner);
  fs.writeFileSync(
    path.join(process.env.GITHUB_WORKSPACE, "provider", ".projenrc.js"),
    projenrc,
  );
};
