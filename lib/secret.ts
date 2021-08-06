import { Construct } from 'constructs';
import { Resource, TerraformVariable } from 'cdktf';
import { ActionsSecret } from '@cdktf/provider-github'
import { constantCase } from 'change-case';

export class SecretFromVariable extends Resource {
  public readonly name: string;
  public readonly variable: TerraformVariable;

  constructor(scope: Construct, name: string) {
    super(scope, name);

    this.variable = new TerraformVariable(this, name, {
      sensitive: true,
      type: 'string',
    })

    this.variable.overrideLogicalId(name);

    this.name = name;
  }

  public for(repository: string) {
    return new ActionsSecret(this, `secret-${repository}-${this.name}`, {
      plaintextValue: this.variable.value,
      secretName: constantCase(this.name),
      repository
    });
  }
}
