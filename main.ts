import { Construct } from 'constructs';
import { App, TerraformStack, TerraformOutput, RemoteBackend } from 'cdktf';
import { GithubProvider, DataGithubTeam } from '@cdktf/provider-github'
import { GithubRepository, SecretFromVariable } from './lib'
import * as fs from 'fs'
import * as path from 'path'

const providers: Record<string, string> = JSON.parse(fs.readFileSync(path.join(__dirname, 'provider.json'), 'utf8'));
interface GitUrls {
  html: string;
  ssh: string;
}
class TerraformCdkProviderStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    const team = new DataGithubTeam(this, 'cdktf-team', {
      slug: 'cdktf',
    });

    new RemoteBackend(this, {
      organization: 'cdktf-team',
      workspaces: {
        name: 'prebuilt-providers'
      }
    })

    const secrets = [
      'gh-token',
      'npm-token',
      'nuget-api-key',
      'twine-username',
      'twine-password'
    ].map(name => new SecretFromVariable(this, name))

    const npmSecret = secrets.find(s => s.name === 'npm-token')
    if (!npmSecret) throw new Error('npm-token secret not found');

    new GithubProvider(this, 'terraform-cdk-providers', {
      owner: 'hashicorp'
    })

    const selfTokens = [
      new SecretFromVariable(this, 'tf-cloud-token'),
      new SecretFromVariable(this, 'gh-comment-token')
    ]
    const self = new GithubRepository(this, 'cdktf-repository-manager', {
      team
    })
    selfTokens.forEach(token => token.for(self.resource.name))

    const templateRepository = new GithubRepository(this, 'cdktf-provider-project', {
      team
    })

    npmSecret.for(templateRepository.resource.name)

    const providerRepos:GitUrls[] = Object.keys(providers).map((provider) => {
      const repo = new GithubRepository(this, `cdktf-provider-${provider}`, {
        description: `Prebuilt Terraform CDK (cdktf) provider for ${provider}.`,
        topics: [provider],
        team,
        protectMain: true
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
const stack = new TerraformCdkProviderStack(app, 'repos');
// Override until https://github.com/integrations/terraform-provider-github/issues/910 is fixed
stack.addOverride('terraform.required_providers.github.version', '4.14.0');
app.synth();
