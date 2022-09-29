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

const providers: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(__dirname, "provider.json"), "utf8")
);

const GITHUB_ACCOUNT_TARGETS: { [provider: string]: "hashicorp" | "cdktf" } = {
  // default all to "hashicorp"
  ...Object.fromEntries(
    Object.keys(providers).map((provider) => [provider, "cdktf"])
  ),
  // overrides
  hashicups: "cdktf",
};

interface GitUrls {
  html: string;
  ssh: string;
}
class TerraformCdkProviderStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

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

    const githubProviderHashiCorp = new GithubProvider(
      this,
      "github-provider-hashicorp",
      {
        owner: "hashicorp",
      }
    );

    const githubProviderCdktf = new GithubProvider(
      this,
      "github-provider-cdktf",
      {
        owner: "cdktf",
        alias: "cdktf",
      }
    );

    function getTargetGithubProvider(provider: string): GithubProvider {
      switch (GITHUB_ACCOUNT_TARGETS[provider]) {
        case "cdktf":
          return githubProviderCdktf;
        case "hashicorp":
          return githubProviderHashiCorp;
        default:
          throw new Error(`Unexpected provider name ${provider}`);
      }
    }

    const teamHashiCorp = new DataGithubTeam(this, "cdktf-team-hashicorp", {
      slug: "cdktf",
      provider: githubProviderHashiCorp,
    });
    const teamCdktf = new DataGithubTeam(this, "cdktf-team-cdktf", {
      slug: "tf-cdk-team",
      provider: githubProviderCdktf,
    });

    function getTargetTeam(provider: string): DataGithubTeam {
      switch (GITHUB_ACCOUNT_TARGETS[provider]) {
        case "cdktf":
          return teamCdktf;
        case "hashicorp":
          return teamHashiCorp;
        default:
          throw new Error(`Unexpected provider name ${provider}`);
      }
    }

    new RemoteBackend(this, {
      organization: "cdktf-team",
      workspaces: {
        name: "prebuilt-providers",
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

    const selfTokens = [
      new SecretFromVariable(this, "tf-cloud-token"),
      new SecretFromVariable(this, "gh-comment-token"),
    ];
    const self = new GithubRepository(this, "cdktf-repository-manager", {
      team: teamHashiCorp,
      webhookUrl: slackWebhook.stringValue,
      provider: githubProviderHashiCorp,
    });
    selfTokens.forEach((token) =>
      token.for(self.resource, githubProviderHashiCorp)
    );

    const templateRepository = new GithubRepository(
      this,
      "cdktf-provider-project",
      {
        team: teamHashiCorp,
        webhookUrl: slackWebhook.stringValue,
        provider: githubProviderHashiCorp,
      }
    );

    npmSecret.for(templateRepository.resource, githubProviderHashiCorp);

    const providerRepos: GitUrls[] = Object.keys(providers).map((provider) => {
      const ghProvider = getTargetGithubProvider(provider);
      const team = getTargetTeam(provider);

      const repo = new GithubRepository(this, `cdktf-provider-${provider}`, {
        description: `Prebuilt Terraform CDK (cdktf) provider for ${provider}.`,
        topics: [provider],
        team,
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
        provider: ghProvider,
      });

      // repo to publish go packages to
      new GithubRepository(this, `cdktf-provider-${provider}-go`, {
        description: `CDK for Terraform Go provider bindings for ${provider}.`,
        topics: [provider],
        team,
        protectMain: false,
        webhookUrl: slackWebhook.stringValue,
        provider: ghProvider,
      });

      secrets.forEach((secret) => secret.for(repo.resource, ghProvider));

      return {
        html: repo.resource.htmlUrl,
        ssh: repo.resource.sshCloneUrl,
      };
    });

    new TerraformOutput(this, `providerRepos`, {
      value: `\${[${providerRepos.map((e) => `"${e.ssh}"`).join(",")}]}`,
    });

    new TerraformOutput(this, "templateRepoUrl", {
      value: templateRepository.resource.htmlUrl,
    });

    new TerraformOutput(this, "selfRepoUrl", {
      value: self.resource.htmlUrl,
    });
  }
}

const app = new App();
const stack = new TerraformCdkProviderStack(app, "repos");
// Override until https://github.com/integrations/terraform-provider-github/issues/910 is fixed
stack.addOverride("terraform.required_providers.github.version", "4.14.0");
app.synth();
