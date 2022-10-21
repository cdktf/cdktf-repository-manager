import { Construct } from "constructs";
import {
  App,
  TerraformStack,
  TerraformOutput,
  RemoteBackend,
  Annotations,
} from "cdktf";
import { GithubProvider, DataGithubTeam } from "@cdktf/provider-github";
import { GithubRepository, SecretFromVariable } from "./lib";
import * as fs from "fs";
import * as path from "path";
import { TerraformVariable } from "cdktf";

type StackShards = {
  primaryStack: string;
  stacks: {
    [name: string]: {
      backend: {
        workspaceName: string;
      };
      providers: string[];
    };
  };
};

const allProviders: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(__dirname, "provider.json"), "utf8")
);

const shardedStacks: StackShards = JSON.parse(
  fs.readFileSync(path.join(__dirname, "sharded-stacks.json"), "utf8")
);

interface GitUrls {
  html: string;
  ssh: string;
}

/**
 * Get list of providers that need to be generated for a stack with name
 *
 * @param name name of stack as defined in sharded-stacks.json
 * @returns Object containing provider name to terraform provider version
 */
function getShardedStackProviders(name: string): Record<string, string> {
  const stackShardInformation = shardedStacks.stacks[name];
  const stackProvidersList = stackShardInformation.providers;

  return Object.fromEntries(
    Object.entries(allProviders).filter(([key]) =>
      stackProvidersList.includes(key)
    )
  );
}

class TerraformCdkProviderStack extends TerraformStack {
  constructor(scope: Construct, name: string, isPrimaryStack: boolean) {
    super(scope, name);

    const providers = getShardedStackProviders(name);
    this.validateProviderNames(providers);

    const githubProvider = new GithubProvider(this, "github-provider-cdktf", {
      owner: "cdktf",
      alias: "cdktf",
    });

    const githubTeam = new DataGithubTeam(this, "cdktf-team-cdktf", {
      slug: "tf-cdk-team",
      provider: githubProvider,
    });

    new RemoteBackend(this, {
      organization: "cdktf-team",
      workspaces: {
        name: shardedStacks.stacks[name].backend.workspaceName,
      },
    });

    const slackWebhook = new TerraformVariable(this, "slack-webhook", {
      type: "string",
    });
    slackWebhook.overrideLogicalId("slack-webhook");

    const secrets = [
      "gh-token",
      "npm-token",
      "nuget-api-key",
      "twine-username",
      "twine-password",
      "maven-username",
      "maven-password",
      "maven-gpg-private-key",
      "maven-gpg-private-key-passphrase",
      "maven-staging-profile-id",
    ].map((name) => new SecretFromVariable(this, name));

    const npmSecret = secrets.find((s) => s.name === "npm-token");
    if (!npmSecret) throw new Error("npm-token secret not found");

    const ghSecret = secrets.find((s) => s.name === "gh-token");
    if (!ghSecret) throw new Error("gh-token secret not found");

    ghSecret.addAlias("PROJEN_GITHUB_TOKEN");
    ghSecret.addAlias("GO_GITHUB_TOKEN"); // used for publishing Go packages to separate repo

    if (isPrimaryStack) {
      this.createRepositoryManagerRepo(
        slackWebhook,
        githubProvider,
        githubTeam
      );
      this.createProviderProjectRepo(
        slackWebhook,
        npmSecret,
        githubProvider,
        githubTeam
      );
    }

    const providerRepos: GitUrls[] = Object.keys(providers).map((provider) => {
      const repo = new GithubRepository(this, `cdktf-provider-${provider}`, {
        description: `Prebuilt Terraform CDK (cdktf) provider for ${provider}.`,
        topics: [provider],
        team: githubTeam,
        protectMain: true,
        protectMainChecks: [
          "build",
          "package-js",
          "package-java",
          "package-python",
          "package-dotnet",
          "package-go",
        ],
        webhookUrl: slackWebhook.stringValue,
        provider: githubProvider,
      });

      // repo to publish go packages to
      new GithubRepository(this, `cdktf-provider-${provider}-go`, {
        description: `CDK for Terraform Go provider bindings for ${provider}.`,
        topics: [provider],
        team: githubTeam,
        protectMain: false,
        webhookUrl: slackWebhook.stringValue,
        provider: githubProvider,
      });

      secrets.forEach((secret) => secret.for(repo.resource, githubProvider));

      return {
        html: repo.resource.htmlUrl,
        ssh: repo.resource.sshCloneUrl,
      };
    });

    new TerraformOutput(this, `providerRepos`, {
      value: `\${[${providerRepos.map((e) => `"${e.ssh}"`).join(",")}]}`,
    });
  }

  private createProviderProjectRepo(
    slackWebhook: TerraformVariable,
    npmSecret: SecretFromVariable,
    githubProvider: GithubProvider,
    githubTeam: DataGithubTeam
  ) {
    const templateRepository = new GithubRepository(
      this,
      "cdktf-provider-project",
      {
        team: githubTeam,
        webhookUrl: slackWebhook.stringValue,
        provider: githubProvider,
      }
    );

    npmSecret.for(templateRepository.resource, githubProvider);

    new TerraformOutput(this, "templateRepoUrl", {
      value: templateRepository?.resource.htmlUrl,
    });
  }

  private createRepositoryManagerRepo(
    slackWebhook: TerraformVariable,
    githubProvider: GithubProvider,
    githubTeam: DataGithubTeam
  ) {
    const selfTokens = [
      new SecretFromVariable(this, "tf-cloud-token"),
      new SecretFromVariable(this, "gh-comment-token"),
    ];

    const self = new GithubRepository(this, "cdktf-repository-manager", {
      team: githubTeam,
      webhookUrl: slackWebhook.stringValue,
      provider: githubProvider,
    });

    selfTokens.forEach((token) => token.for(self.resource, githubProvider));

    new TerraformOutput(this, "selfRepoUrl", {
      value: self.resource.htmlUrl,
    });
  }

  private validateProviderNames(providers: Record<string, string>) {
    // validate that providers contain only valid names (-go suffix is forbidden)
    const goSuffixProviders = Object.keys(providers).filter((key) =>
      key.endsWith("-go")
    );
    if (goSuffixProviders.length > 0) {
      Annotations.of(this).addError(
        `Providers contain a provider key with a suffix -go which is not allowed due to conflicts with go package repositories. Please remove the -go suffix from these provider keys ${goSuffixProviders.join(
          ", "
        )}`
      );
    }

    // validate key matches provider name
    const notMatchingProviders = Object.entries(providers).filter(
      ([key, value]) => {
        const fullProviderName = new RegExp("(.*)@", "g").exec(value)![1];
        const providerName = fullProviderName.includes("/")
          ? fullProviderName.split("/")[1]
          : fullProviderName;

        const sanitizedProviderName = providerName.replace(/-/g, "");
        return key !== sanitizedProviderName;
      }
    );
    if (notMatchingProviders.length > 0) {
      Annotations.of(this).addError(
        `Provider name and provider key do not match for ${notMatchingProviders.join(
          ", "
        )}. This leads to issues when deploying go packages. Please rename the provider key to match the provider name.`
      );
    }
  }
}

const app = new App();

const primaryStackName = shardedStacks.primaryStack;
const stackNames = Object.keys(shardedStacks.stacks);
const allProvidersInShards = Object.values(shardedStacks.stacks)
  .map((stack) => stack.providers)
  .flat() as string[];
const allProviderNames = Object.keys(allProviders);

// Validations for provider names
const shardProviderSet = new Set(allProvidersInShards);
const allProviderSet = new Set(allProviderNames);
const missingProvidersInShards = new Set(
  [...allProviderSet].filter((provider) => !shardProviderSet.has(provider))
);
const missingProvidersInAllProviders = new Set(
  [...shardProviderSet].filter((provider) => !allProviderSet.has(provider))
);

if (shardProviderSet.size < allProvidersInShards.length) {
  throw new Error("Duplicates present in sharded-stacks.json");
}

if (missingProvidersInShards.size > 0) {
  throw new Error(
    `One or more providers present in provider.json are missing in sharded-stacks.json: ${[
      ...missingProvidersInShards,
    ]}`
  );
}

if (missingProvidersInAllProviders.size > 0) {
  throw new Error(
    `One or more providers present in sharded-stacks.json are missing in provider.json: ${[
      ...missingProvidersInAllProviders,
    ]}`
  );
}

if (!primaryStackName) {
  throw new Error("Cannot proceed without a primary stack");
}
if (!stackNames.includes(primaryStackName)) {
  throw new Error("Cannot proceed with a non-existent stack as primary");
}

stackNames.forEach((stackName) => {
  const stack = new TerraformCdkProviderStack(
    app,
    stackName,
    primaryStackName === stackName
  );
  // Override until https://github.com/integrations/terraform-provider-github/issues/910 is fixed
  stack.addOverride("terraform.required_providers.github.version", "4.14.0");
});

app.synth();
