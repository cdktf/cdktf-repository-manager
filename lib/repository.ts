import { Construct } from 'constructs';
import { Resource } from 'cdktf';
import { Repository } from '@cdktf/provider-github'

export interface RepositoryConfig {
  description?: string;
  topics?: string[];
}

export class GithubRepository extends Resource {
  public readonly resource: Repository;

  constructor(scope: Construct, name: string, config: RepositoryConfig) {
    super(scope, name);

    const {
      topics = [],
      description = 'Repository management for prebuilt cdktf providers via cdktf',
    } = config;

    this.resource = new Repository(this, 'repo', {
      name,
      description,
      visibility: 'public',
      homepageUrl: 'https://cdk.tf',
      hasIssues: true,
      hasWiki: false,
      hasProjects: false,
      deleteBranchOnMerge: true,
      topics: ['cdktf', 'terraform', 'terraform-cdk', 'cdk', 'provider', 'pre-built-provider', ...topics]
    })
  }
}