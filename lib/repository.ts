/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { Construct } from "constructs";
import { SecretFromVariable } from "./secrets";
import { GithubProvider } from "@cdktf/provider-github/lib/provider";
import { Repository } from "@cdktf/provider-github/lib/repository";
import { DataGithubRepository } from "@cdktf/provider-github/lib/data-github-repository";
import { IssueLabel } from "@cdktf/provider-github/lib/issue-label";
import { BranchProtection } from "@cdktf/provider-github/lib/branch-protection";
import { TeamRepository } from "@cdktf/provider-github/lib/team-repository";
import { RepositoryWebhook } from "@cdktf/provider-github/lib/repository-webhook";
import { RepositoryDependabotSecurityUpdates } from "@cdktf/provider-github/lib/repository-dependabot-security-updates";

export interface ITeam {
  id: string;
}

export interface RepositoryConfig {
  description?: string;
  topics?: string[];
  team: ITeam;
  protectMain?: boolean;
  protectMainChecks?: string[];
  webhookUrl: string;
  provider: GithubProvider;
}

export class RepositorySetup extends Construct {
  constructor(
    scope: Construct,
    name: string,
    config: Pick<
      RepositoryConfig,
      "team" | "webhookUrl" | "provider" | "protectMain" | "protectMainChecks"
    > & {
      repository: Repository | DataGithubRepository;
    },
  ) {
    super(scope, name);

    const {
      protectMain = false,
      protectMainChecks = ["build", "license/cla"],
      provider,
      repository,
      team,
      webhookUrl,
    } = config;

    new IssueLabel(this, `automerge-label`, {
      color: "5DC8DB",
      name: "automerge",
      repository: repository.name,
      provider,
    });

    new IssueLabel(this, `no-auto-close-label`, {
      color: "EE2222",
      name: "no-auto-close",
      repository: repository.name,
      provider,
    });

    new IssueLabel(this, `auto-approve-label`, {
      color: "8BF8BD",
      name: "auto-approve",
      repository: repository.name,
      provider,
    });

    if (protectMain) {
      new BranchProtection(this, "main-protection", {
        pattern: "main",
        repositoryId: repository.name,
        enforceAdmins: true,
        allowsDeletions: false,
        allowsForcePushes: false,
        requiredPullRequestReviews: [
          {
            requiredApprovingReviewCount: 1,
            requireCodeOwnerReviews: false, // NOTE: In the future, Security wants to enforce this, so be warned...
            dismissStaleReviews: false,
          },
        ],
        requireConversationResolution: true,
        requiredLinearHistory: true,
        requiredStatusChecks: [
          {
            strict: false,
            contexts: protectMainChecks,
          },
        ],
        provider,
      });
    }

    new TeamRepository(this, "managing-team", {
      repository: repository.name,
      teamId: team.id,
      permission: "admin",
      provider,
    });

    // Slack integration so we can be notified about new PRs and Issues
    new RepositoryWebhook(this, "slack-webhook", {
      repository: repository.name,

      configuration: {
        url: webhookUrl,
        contentType: "json",
      },

      // We don't need to notify about PRs since they are auto-created
      events: ["issues"],
      provider,
    });
  }
}

export class GithubRepository extends Construct {
  public readonly resource: Repository;
  private readonly provider: GithubProvider;
  public static defaultTopics = [
    "cdktf",
    "terraform",
    "terraform-cdk",
    "cdk",
    "provider",
    "pre-built-provider",
  ];

  constructor(scope: Construct, name: string, config: RepositoryConfig) {
    super(scope, name);

    const {
      topics = GithubRepository.defaultTopics,
      description = "Repository management for prebuilt cdktf providers via cdktf",
      provider,
    } = config;
    this.provider = provider;

    this.resource = new Repository(this, "repo", {
      name,
      description,
      archiveOnDestroy: true,
      visibility: "public",
      homepageUrl: "https://cdk.tf",
      hasIssues: !name.endsWith("-go"),
      hasWiki: false,
      autoInit: true,
      hasProjects: false,
      deleteBranchOnMerge: true,
      allowAutoMerge: true,
      allowUpdateBranch: true,
      squashMergeCommitMessage: "PR_BODY",
      squashMergeCommitTitle: "PR_TITLE",
      vulnerabilityAlerts: !name.endsWith("-go"),
      topics,
      provider,
    });

    new RepositorySetup(this, "repository-setup", {
      ...config,
      repository: this.resource,
    });
    
    if (!name.endsWith("-go")) {
      new RepositoryDependabotSecurityUpdates(this, "dependabot-security", {
        provider,
        repository: this.resource.name,
        enabled: true,
      });
    }
  }

  addSecret(name: string) {
    const variable = new SecretFromVariable(this, name);
    variable.for(this.resource, this.provider);
  }
}

export class GithubRepositoryFromExistingRepository extends Construct {
  public readonly resource: DataGithubRepository;

  constructor(
    scope: Construct,
    name: string,
    config: RepositoryConfig & {
      repositoryName: string;
    },
  ) {
    super(scope, name);

    this.resource = new DataGithubRepository(this, "repo", {
      name: config.repositoryName,
      provider: config.provider,
    });

    new RepositorySetup(this, "repository-setup", {
      ...config,
      repository: this.resource,
    });
    
    if (!name.endsWith("-go")) {
      new RepositoryDependabotSecurityUpdates(this, "dependabot-security", {
        provider: config.provider,
        repository: this.resource.name,
        enabled: true,
      });
    }
  }
}
