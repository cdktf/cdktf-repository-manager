const fs = require("fs");
const path = require("path");

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

async function getBeforeAndAfterFiles(exec, dir, fileName, isJson) {
  const after = fs.readFileSync(path.join(dir, fileName), "utf8");

  let before;
  try {
    before = (
      await exec.getExecOutput("git", ["show", `HEAD:${fileName}`], {
        cwd: dir,
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

  return {
    before: isJson ? JSON.parse(before) : before,
    after: isJson ? JSON.parse(after) : after,
  };
}

module.exports = async ({ core, exec }) => {
  const providerDirectory = path.join(process.env.GITHUB_WORKSPACE, "provider");

  const { before, after } = await getBeforeAndAfterFiles(
    exec,
    providerDirectory,
    ".projenrc.js"
  );
  const { before: beforeVersion, after: afterVersion } =
    await getBeforeAndAfterFiles(
      exec,
      providerDirectory,
      path.join("src", "version.json"),
      true
    );
  const providerVersions = {
    before: before[Object.keys(beforeVersion)[0]],
    after: after[Object.keys(afterVersion)[0]],
  };

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

  let prefix = `chore(deps)${hasBreakingChanges ? "!" : ""}: Updated `;

  let commitMessageParts = [];

  const allChanges = [...results];
  allChanges.forEach((res) => {
    console.log(
      `${res.key}: ${res.before} => ${res.after} (${
        res.breaking ? "breaking" : "non-breaking"
      })`
    );

    if (res.before === res.after) {
      return;
    }

    let name;
    switch (res.key) {
      case "terraformProvider":
        name = `provider version`;
        break;
      case "cdktfVersion":
        name = `CDKTF version`;
        break;
      case "constructsVersion":
        name = `Constructs version`;
        break;
      case "minNodeVersion":
        name = `minimum Node version`;
        break;
      case "jsiiVersion":
        name = "JSII version";
        break;
    }

    commitMessageParts.push(`${name} to \`${res.after}\``);
  });

  if (allChanges.length === 0) {
    commitMessageParts.push("dependencies");
  }

  if (providerNameChanged.before !== providerNameChanged.after) {
    commitMessageParts.push(
      `provider name to \`${providerNameChanged.after}\``
    );
  }

  if (providerVersions.before !== providerVersions.after) {
    commitMessageParts.push(
      `provider version to \`${providerVersions.after}\``
    );
  }

  if (hasBreakingChanges) {
    core.setOutput("has_breaking_changes", true);
  }

  core.setOutput(
    "commit_message",
    `${prefix} ${commitMessageParts.join(", ")}`
  );
};
