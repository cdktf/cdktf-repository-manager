/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { Construct } from "constructs";
import { TerraformVariable } from "cdktf";
import { constantCase } from "change-case";
import { Repository } from "@cdktf/provider-github/lib/repository";
import { DataGithubRepository } from "@cdktf/provider-github/lib/data-github-repository";
import { GithubProvider } from "@cdktf/provider-github/lib/provider";
import { ActionsSecret } from "@cdktf/provider-github/lib/actions-secret";

export class SecretFromVariable extends Construct {
  public readonly name: string;
  public readonly variable: TerraformVariable;
  public secretNames: string[] = [];

  constructor(scope: Construct, name: string) {
    super(scope, name);

    this.variable = new TerraformVariable(this, name, {
      sensitive: true,
      type: "string",
    });

    this.variable.overrideLogicalId(name);

    this.name = name;
  }

  public addAlias(alias: string) {
    this.secretNames.push(alias);
  }

  public for(
    repository: Repository | DataGithubRepository,
    ghProvider: GithubProvider
  ) {
    const secret = new ActionsSecret(repository, `secret-${this.name}`, {
      plaintextValue: this.variable.value,
      secretName: constantCase(this.name),
      repository: repository.name,
      provider: ghProvider,
    });

    this.secretNames.forEach((name) => {
      new ActionsSecret(repository, `secret-${this.name}-alias-${name}`, {
        plaintextValue: this.variable.value,
        secretName: constantCase(name),
        repository: repository.name,
        provider: ghProvider,
      });
    });

    return secret;
  }
}

export class PublishingSecretSet extends Construct {
  private readonly secrets: SecretFromVariable[] = [];
  public readonly ghSecret: SecretFromVariable;
  public readonly npmSecret: SecretFromVariable;

  constructor(scope: Construct, name: string) {
    super(scope, name);

    this.secrets = [
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

    const npmSecret = this.secrets.find((s) => s.name === "npm-token");
    if (!npmSecret) throw new Error("npm-token secret not found");

    const ghSecret = this.secrets.find((s) => s.name === "gh-token");
    if (!ghSecret) throw new Error("gh-token secret not found");

    ghSecret.addAlias("PROJEN_GITHUB_TOKEN");
    ghSecret.addAlias("GO_GITHUB_TOKEN"); // used for publishing Go packages to separate repo

    this.ghSecret = ghSecret;
    this.npmSecret = npmSecret;
  }

  public forAllLanguages(
    repository: Repository | DataGithubRepository,
    ghProvider: GithubProvider
  ) {
    this.secrets.forEach((secret) => secret.for(repository, ghProvider));
  }

  private forPrefixedSecrets(
    repository: Repository | DataGithubRepository,
    ghProvider: GithubProvider,
    prefix: string
  ) {
    this.secrets
      .filter((secret) => secret.name.startsWith(prefix))
      .forEach((secret) => secret.for(repository, ghProvider));
  }

  public forGitHub(
    repository: Repository | DataGithubRepository,
    ghProvider: GithubProvider
  ) {
    this.forPrefixedSecrets(repository, ghProvider, "gh-");
  }

  public forTypescript(
    repository: Repository | DataGithubRepository,
    ghProvider: GithubProvider
  ) {
    this.forPrefixedSecrets(repository, ghProvider, "npm-");
  }

  public forPython(
    repository: Repository | DataGithubRepository,
    ghProvider: GithubProvider
  ) {
    this.forPrefixedSecrets(repository, ghProvider, "twine-");
  }

  public forCsharp(
    repository: Repository | DataGithubRepository,
    ghProvider: GithubProvider
  ) {
    this.forPrefixedSecrets(repository, ghProvider, "nuget-");
  }

  public forJava(
    repository: Repository | DataGithubRepository,
    ghProvider: GithubProvider
  ) {
    this.forPrefixedSecrets(repository, ghProvider, "maven-");
  }

  public forGo(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _repository: Repository | DataGithubRepository,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ghProvider: GithubProvider
  ) {
    // No additional go secrets required, this method exists for consistency
  }
}
