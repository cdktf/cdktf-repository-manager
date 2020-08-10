import { Construct } from 'constructs';
import { App, TerraformStack, TerraformOutput } from 'cdktf';
import { Repository, GithubProvider } from './.gen/providers/github'

class TerraformCdkProviderStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new GithubProvider(this, 'terraform-cdk-providers', {
      token: process.env.GITHUB_TOKEN,
      organization: 'terraform-cdk-providers'
    })

    const self = new Repository(this, 'self', {
      name: 'repository-manager',
      description: 'Repository management for prebuilt cdktf providers via cdktf',
      homepageUrl: 'https://cdk.tf',
      hasIssues: true,
      hasWiki: false,
      hasProjects: false,
      deleteBranchOnMerge: true,
      topics: ['cdktf', 'terraform', 'terraform-cdk', 'cdk', 'provider']
    })

    const templateRepository = new Repository(this, 'template', {
      name: 'cdktf-provider-project',
      description: 'Template for setting up repositories to automatically build provider packages for Terraform CDK',
      homepageUrl: 'https://cdk.tf',
      hasIssues: true,
      hasWiki: false,
      hasProjects: false,
      deleteBranchOnMerge: true,
      topics: ['cdktf', 'terraform', 'terraform-cdk', 'cdk', 'provider']
    })

    const providers = ['aws', 'google', 'azurerm', 'null', 'kubernetes', 'docker', 'github']
    providers.forEach((provider) => {
      const repo = new Repository(this, `provider-${provider}`, {
        name: `cdktf-provider-${provider}`,
        description: `Prebuilt Terraform CDK (cdktf) provider for ${provider}`,
        homepageUrl: 'https://cdk.tf',
        hasIssues: false,
        hasWiki: false,
        hasProjects: false,
        deleteBranchOnMerge: true,
        topics: ['cdktf', 'terraform', 'terraform-cdk', 'cdk', 'provider', provider]
      })

      new TerraformOutput(this, `${provider}RepoUrl`, {
        value: repo.htmlUrl
      })
    })

    new TerraformOutput(this, 'templateRepoUrl', {
      value: templateRepository.htmlUrl
    })

    new TerraformOutput(this, 'selfRepoUrl', {
      value: self.htmlUrl
    })
  }
}

const app = new App();
new TerraformCdkProviderStack(app, 'repos');
app.synth();
