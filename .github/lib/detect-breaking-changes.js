const v = (key, input) =>
  new RegExp(`${key}:[\\D]*(\\d+(\\.\\d+)*)`).exec(input)[1];

const terraformProviderName = (input) =>
  new RegExp(`terraformProvider:\\s("|')(.*)@`).exec(input)[2];

const parse = (version) => {
  const parts = version.split(".");
  return {
    major: Number(parts[0]),
    minor: Number(parts[1]),
    patch: Number(parts[2]),
  };
};

const isBreaking = (key, before, after) => {
  const bef = parse(v(key, before));
  const aft = parse(v(key, after));
  const majorIncreased = aft.major > bef.major;
  const isDev = aft.major === 0 && bef.major === 0;
  const minorIncreased = aft.minor > bef.minor;
  return majorIncreased || (isDev && minorIncreased);
};

module.exports = async ({ core, exec }) => {
  const path = require("path");
  const fs = require("fs");
  const after = fs
    .readFileSync(
      path.join(process.env.GITHUB_WORKSPACE, "provider", ".projenrc.js")
    )
    .toString();

  let before;
  try {
    before = (
      await exec.getExecOutput("git", ["show", "HEAD:.projenrc.js"], {
        cwd: path.join(process.env.GITHUB_WORKSPACE, "provider"),
      })
    ).stdout;
  } catch (e) {
    if (e.message.includes("failed with exit code 128")) {
      console.log(e);
      before = after; // no previous version yet? use the current one as previous
    } else {
      throw e;
    }
  }

  const results = [
    "terraformProvider",
    "cdktfVersion",
    "constructsVersion",
    "minNodeVersion",
    "jsiiVersion",
  ].map((key) => ({
    key,
    before: v(key, before),
    after: v(key, after),
    breaking: isBreaking(key, before, after),
  }));

  const providerNameChanged = ["terraformProvider"].map((key) => ({
    key,
    before: terraformProviderName(before),
    after: terraformProviderName(after),
    breaking: terraformProviderName(before) !== terraformProviderName(after),
  }));

  const hasBreakingChanges = [...results, ...providerNameChanged].some(
    (res) => res.breaking
  );

  console.log(
    hasBreakingChanges ? "Found breaking changes!" : "No breaking changes."
  );

  [...results, ...providerNameChanged].forEach((res) =>
    console.log(
      `${res.key}: ${res.before} => ${res.after} (${
        res.breaking ? "breaking" : "non-breaking"
      })`
    )
  );

  if (hasBreakingChanges) {
    core.setOutput("has_breaking_changes", true);
  }
};
