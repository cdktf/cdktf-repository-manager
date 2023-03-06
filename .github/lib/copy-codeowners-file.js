/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

module.exports = () => {
  const path = require("path");
  const fs = require("fs");
  const mainFolder = path.join(process.env.GITHUB_WORKSPACE, "main");
  const codeownersFile = fs.readFileSync(
    path.join(mainFolder, "assets", "codeowners"),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(
      process.env.GITHUB_WORKSPACE,
      "provider",
      ".github",
      "CODEOWNERS"
    ),
    codeownersFile
  );
};
