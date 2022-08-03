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
interface GitUrls {
  html: string;
  ssh: string;
}
class TerraformCdkProviderStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    // validate that providers contain only valid names (-go suffix is forbidden)
    if (Object.keys(providers).some((key) => key.endsWith("-go"))) {
      Annotations.of(this).addError(
        "providers contain a provider key with a suffix -go which is not allowed due to conflicts with go package repositories"
      );
    }

    const team = new DataGithubTeam(this, "cdktf-team", {
      slug: "cdktf",
    });

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

    new GithubProvider(this, "terraform-cdk-providers", {
      owner: "hashicorp",
    });

    const selfTokens = [
      new SecretFromVariable(this, "tf-cloud-token"),
      new SecretFromVariable(this, "gh-comment-token"),
    ];
    const self = new GithubRepository(this, "cdktf-repository-manager", {
      team,
      webhookUrl: slackWebhook.stringValue,
    });
    selfTokens.forEach((token) => token.for(self.resource));

    const templateRepository = new GithubRepository(
      this,
      "cdktf-provider-project",
      {
        team,
        webhookUrl: slackWebhook.stringValue,
      }
    );

    npmSecret.for(templateRepository.resource);

    const providerRepos: GitUrls[] = Object.keys(providers).map((provider) => {
      const repo = new GithubRepository(this, `cdktf-provider-${provider}`, {
        description: `Prebuilt Terraform CDK (cdktf) provider for ${provider}.`,
        topics: [provider],
        team,
        protectMain: true,
        webhookUrl: slackWebhook.stringValue,
      });

      // repo to publish go packages to
      new GithubRepository(this, `cdktf-provider-${provider}-go`, {
        description: `CDK for Terraform Go provider bindings for ${provider}.`,
        topics: [provider],
        team,
        protectMain: false,
        webhookUrl: slackWebhook.stringValue,
      });

      secrets.forEach((secret) => secret.for(repo.resource));

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
