import { Construct } from 'constructs';
import { App, TerraformStack, TerraformOutput, RemoteBackend } from 'cdktf';
import { GithubProvider } from '@cdktf/provider-github'
import { GithubRepository, SecretFromVariable } from './lib'

interface GitUrls {
  html: string;
  ssh: string;
}
class TerraformCdkProviderStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new RemoteBackend(this, {
      organization: 'cdktf-team',
      workspaces: {
        name: 'prebuilt-providers'
      }
    })

    new SecretFromVariable(this, 'github-token');

    new GithubProvider(this, 'terraform-cdk-providers', {
      // see https://github.com/hashicorp/terraform-cdk/issues/898
      token: '${var.github-token}',
      owner: 'hashicorp'
    })

    const selfTokens = [
      new SecretFromVariable(this, 'tf-cloud-token'),
      new SecretFromVariable(this, 'gh-comment-token')
    ]
    const self = new GithubRepository(this, 'cdktf-repository-manager', {})
    selfTokens.forEach(token => token.for(self.resource.name))

    const templateRepository = new GithubRepository(this, 'cdktf-provider-project', {})

    const secrets = [
      'npm-token',
      'nuget-api-key',
      'twine-user-name',
      'twine-password'
    ].map(name => new SecretFromVariable(this, name))

    const providers = ['aws', 'google', 'azurerm', 'null', 'kubernetes', 'docker', 'github', 'external', 'datadog']


    const providerRepos:GitUrls[] = providers.map((provider) => {
      const repo = new GithubRepository(this, `cdktf-provider-${provider}`, {
        description: `Prebuilt Terraform CDK (cdktf) provider for ${provider}.`,
        topics: [provider],
      })

      secrets.forEach(secret => secret.for(repo.resource.name))

      return {
        html: repo.resource.htmlUrl,
        ssh: repo.resource.sshCloneUrl
      }
    })

    new TerraformOutput(this, `providerRepos`, {
      value: `\${[${providerRepos.map(e => (`"${e.ssh}"`)).join(',')}]}`
    })

    new TerraformOutput(this, 'templateRepoUrl', {
      value: templateRepository.resource.htmlUrl
    })

    new TerraformOutput(this, 'selfRepoUrl', {
      value: self.resource.htmlUrl
    })
  }
}

const app = new App();
new TerraformCdkProviderStack(app, 'repos');
app.synth();
