import { Construct } from "constructs";
import { Resource, TerraformVariable } from "cdktf";
import {
  ActionsSecret,
  GithubProvider,
  Repository,
} from "@cdktf/provider-github";
import { constantCase } from "change-case";

export class SecretFromVariable extends Resource {
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

  public for(repository: Repository, ghProvider: GithubProvider) {
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
