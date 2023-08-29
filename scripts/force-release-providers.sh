#!/usr/bin/env bash

if [[ $# -eq 0 ]] ; then
    echo 'Usage: scripts/force-release-providers.sh <filter>'
    echo
    echo 'This script runs the workflow "force-release" on every provider listed in provider.json'
    echo 'Please note that the tool is quite naive and will generate a release for every provider you agree with'
    echo 'It DOES NOT see if the previous release is there or not, so please exercise caution while using it'
    echo
    echo 'It does ask before forcing the release for every provider individually, so it can be used for a subset of providers'
    echo
    echo 'Example usage:'
    echo '  scripts/force-release-providers.sh 0.18.0'
    exit 0
fi

providers=$(jq -rcM "keys | .[]" provider.json)
org="cdktf"
filter=$1
workflow_name=force-release

for provider in $providers; do
  read -p "Creating workflow for provider $provider. Continue? [y/n] " -n 1 -r
  echo

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Finding SHA for PR for $provider"
    repo_name="cdktf/cdktf-provider-$provider"

    output=$(gh pr list --repo $repo_name --state merged --json mergeCommit --search "$filter" | jq -rcM '.[] | .mergeCommit.oid')

    echo "SHA found: $output"

    echo "Running workflow for $provider"
    gh workflow run "${workflow_name}.yml" --repo $repo_name -f sha=$output -f publish_to_go=true | head -1
    sleep 3
    url=$(gh run list --workflow="${workflow_name}.yml" --repo $repo_name --limit 1 --json url | jq -rcM '.[] | .url')

    echo "Workflow started: $url"
    echo
  fi
done

