import { Construct } from 'constructs';
import { Resource } from 'cdktf';
import { Repository, TeamRepository } from '@cdktf/provider-github'

export interface ITeam {
  id: string;
}

export interface RepositoryConfig {
  description?: string;
  topics?: string[];
  team: ITeam;
}

export class GithubRepository extends Resource {
  public readonly resource: Repository;

  constructor(scope: Construct, name: string, config: RepositoryConfig) {
    super(scope, name);

    const {
      topics = [],
      description = 'Repository management for prebuilt cdktf providers via cdktf',
      team,
    } = config;

    this.resource = new Repository(this, 'repo', {
      name,
      description,
      visibility: 'public',
      homepageUrl: 'https://cdk.tf',
      hasIssues: true,
      hasWiki: false,
      autoInit: true,
      hasProjects: false,
      deleteBranchOnMerge: true,
      topics: ['cdktf', 'terraform', 'terraform-cdk', 'cdk', 'provider', 'pre-built-provider', ...topics],
    })

    new TeamRepository(this, 'managing-team', {
      repository: this.resource.name,
      teamId: team.id,
      permission: 'admin'
    })
  }
}