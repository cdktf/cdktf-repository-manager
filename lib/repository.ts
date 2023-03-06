/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { Construct } from "constructs";
import {
  Repository,
  TeamRepository,
  BranchProtection,
  IssueLabel,
  RepositoryWebhook,
  GithubProvider,
  DataGithubRepository,
  RepositoryFile,
} from "@cdktf/provider-github";
import { SecretFromVariable } from "./secrets";
import { TerraformAsset } from "cdktf";
import path = require("path");

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
      repositoryName: string;
    }
  ) {
    super(scope, name);

    const {
      protectMain = false,
      protectMainChecks = ["build"],
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

    if (protectMain) {
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

    // Only for go provider repositories
    if (config.repositoryName.endsWith("-go")) {
      const asset = new TerraformAsset(this, "codeowners-asset", {
        path: path.resolve(__dirname, "..", "assets", "codeowners"),
      });
      new RepositoryFile(this, "codeowners", {
        repository: repository.fullName,
        file: "CODEOWNERS",
        commitAuthor: "team-tf-cdk",
        commitEmail: "github-team-tf-cdk@hashicorp.com",
        branch: "main",
        commitMessage: "Managed by Terraform",
        overwriteOnCreate: false,
        content: `\${file("${asset.path}")}`,
      });
    }
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
      visibility: "public",
      homepageUrl: "https://cdk.tf",
      hasIssues: true,
      hasWiki: false,
      autoInit: true,
      hasProjects: false,
      deleteBranchOnMerge: true,
      topics,
      provider,
    });

    new RepositorySetup(this, "repository-setup", {
      ...config,
      repositoryName: name,
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
