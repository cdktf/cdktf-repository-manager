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
import { setOldId } from "./logical-id-override";

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
    }
  ) {
    super(scope, name);
    const moveLabel = (label: string) => `${this.node.path}-${label}`;

    const {
      protectMain = false,
      protectMainChecks = ["build"],
      provider,
      repository,
      team,
      webhookUrl,
    } = config;

    const oldIssueLabel = new IssueLabel(this, `automerge-label-old`, {
      color: "5DC8DB",
      name: "automerge",
      repository: repository.name,
      provider,
    });
    setOldId(oldIssueLabel);
    oldIssueLabel.moveTo(moveLabel("automerge-label"));
    new IssueLabel(this, `automerge-label`, {
      color: "5DC8DB",
      name: "automerge",
      repository: repository.name,
      provider,
    }).addMoveTarget(moveLabel("automerge-label"));

    if (protectMain) {
      const oldProtectMain = new BranchProtection(this, "main-protection-old", {
        pattern: "main",
        repositoryId: repository.name,
        enforceAdmins: true,
        allowsDeletions: false,
        allowsForcePushes: false,
        requiredStatusChecks: [
          {
            strict: true,
            contexts: protectMainChecks,
          },
        ],
        provider,
      });
      setOldId(oldProtectMain);
      oldProtectMain.moveTo(moveLabel("main-protection"));

      new BranchProtection(this, "main-protection", {
        pattern: "main",
        repositoryId: repository.name,
        enforceAdmins: true,
        allowsDeletions: false,
        allowsForcePushes: false,
        requiredStatusChecks: [
          {
            strict: true,
            contexts: protectMainChecks,
          },
        ],
        provider,
      }).addMoveTarget(moveLabel("main-protection"));
    }

    const oldManagingTeam = new TeamRepository(this, "managing-team-old", {
      repository: repository.name,
      teamId: team.id,
      permission: "admin",
      provider,
    });
    setOldId(oldManagingTeam);
    oldManagingTeam.moveTo(moveLabel("managing-team"));
    new TeamRepository(this, "managing-team", {
      repository: repository.name,
      teamId: team.id,
      permission: "admin",
      provider,
    }).addMoveTarget(moveLabel("managing-team"));

    // Slack integration so we can be notified about new PRs and Issues
    const oldSlackIntegration = new RepositoryWebhook(
      this,
      "slack-webhook-old",
      {
        repository: repository.name,

        configuration: {
          url: webhookUrl,
          contentType: "json",
        },

        // We don't need to notify about PRs since they are auto-created
        events: ["issues"],
        provider,
      }
    );
    setOldId(oldSlackIntegration);
    oldSlackIntegration.moveTo(moveLabel("slack-webhook"));
    new RepositoryWebhook(this, "slack-webhook", {
      repository: repository.name,

      configuration: {
        url: webhookUrl,
        contentType: "json",
      },

      // We don't need to notify about PRs since they are auto-created
      events: ["issues"],
      provider,
    }).addMoveTarget(moveLabel("slack-webhook"));
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
    const moveLabel = (label: string) => `${this.node.path}-${label}`;

    const oldRepo = new Repository(this, "repo-old", {
      name,
      description,
      visibility: "public",
      homepageUrl: "https://cdk.tf",
      hasIssues: !name.endsWith("-go"),
      hasWiki: false,
      autoInit: true,
      hasProjects: false,
      deleteBranchOnMerge: true,
      topics,
      provider,
    });
    setOldId(oldRepo);
    oldRepo.moveTo(moveLabel("repo"));

    this.resource = new Repository(this, "repo", {
      name,
      description,
      visibility: "public",
      homepageUrl: "https://cdk.tf",
      hasIssues: !name.endsWith("-go"),
      hasWiki: false,
      autoInit: true,
      hasProjects: false,
      deleteBranchOnMerge: true,
      topics,
      provider,
    });
    this.resource.addMoveTarget(moveLabel("repo"));

    new RepositorySetup(this, "repository-setup", {
      ...config,
      repository: this.resource,
    });
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
    config: Pick<RepositoryConfig, "team" | "webhookUrl" | "provider"> & {
      repositoryName: string;
    }
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
  }
}
