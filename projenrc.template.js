const { CdktfProviderProject } = require("@cdktf/provider-project");
const project = new CdktfProviderProject({
  useCustomGithubRunner: __CUSTOM_RUNNER__,
  terraformProvider: "__PROVIDER__",
  cdktfVersion: "^0.12.2 || ^0.13.0",
  constructsVersion: "^10.0.0",
  minNodeVersion: "14.17.0",
  jsiiVersion: "^1.53.0",
});

project.synth();
