module.exports = async ({ github, runNumber, providerName }) => {
    const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env
    const url = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    const repo = `cdktf-provider-${providerName}`
    const owner = 'cdktf'

    const { data } = await github.pulls.create({
        owner,
        repo,
        head: `upgrade-provider-project-${runNumber}`,
        base: "main",
        title: "chore(deps): upgrade provider project",
        maintainer_can_modify: true,
        body: `Triggered by ${url}`
    })

    console.log(`Created a PR: ${data.html_url}`)

    await github.issues.addLabels({
        owner,
        repo,
        issue_number: data.number,
        labels: ['automerge']
    })

}