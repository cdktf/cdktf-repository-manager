import { Construct } from "constructs";
import { Resource } from "cdktf";
import {
  Repository,
  TeamRepository,
  BranchProtection,
  IssueLabel,
  RepositoryWebhook,
} from "@cdktf/provider-github";

export interface ITeam {
  id: string;
}

export interface RepositoryConfig {
  description?: string;
  topics?: string[];
  team: ITeam;
  protectMain?: boolean;
  webhookUrl: string;
}

export class GithubRepository extends Resource {
  public readonly resource: Repository;

  constructor(scope: Construct, name: string, config: RepositoryConfig) {
    super(scope, name);

    const {
      topics = [],
      description = "Repository management for prebuilt cdktf providers via cdktf",
      team,
      protectMain = false,
    } = config;

    this.resource = new Repository(this, "repo", {
      name,
      description,
      visibility: "public",
      homepageUrl: "https://cdk.tf",
      hasIssues: true,
      hasWiki: false,
      autoInit: true,
      hasProjects: false,
      deleteBranchOnMerge: true,
      topics: [
        "cdktf",
        "terraform",
        "terraform-cdk",
        "cdk",
        "provider",
        "pre-built-provider",
        ...topics,
      ],
    });

    new IssueLabel(this, `automerge-label`, {
      color: "5DC8DB",
      name: "automerge",
      repository: this.resource.name,
    });

    if (protectMain) {
      new BranchProtection(this, "main-protection", {
        pattern: "main",
        repositoryId: this.resource.name,
        enforceAdmins: true,
        allowsDeletions: false,
        allowsForcePushes: false,
        requiredStatusChecks: [
          {
            strict: true,
            contexts: ["build"],
          },
        ],
      });
    }

    new TeamRepository(this, "managing-team", {
      repository: this.resource.name,
      teamId: team.id,
      permission: "admin",
    });

    // Slack integration so we can be notified about new PRs and Issues
    new RepositoryWebhook(this, "slack-webhook", {
      repository: this.resource.name,

      configuration: [
        {
          url: config.webhookUrl,
          contentType: "json",
        },
      ],

      // We don't need to notify about PRs since they are auto-created
      events: ["issues"],
    });
  }
}
