
module.exports = ({ context, github, stackName }) => {
    const { readFileSync } = require("fs")
    const data = readFileSync(`./plan_stdout_${stackName}.txt`, 'utf-8')
    const isLargeOutput = data.length > 65000
    const refreshLinesRegex = /: Refreshing state\.\.\.\s*\[id=/i
    const { steps } = context

    let plan = data
    if (isLargeOutput)
        plan = plan.split("\n").filter(line => !refreshLinesRegex.test(line)).join("\n")

    plan = plan.length > 65000 ? `${plan.substring(0, 65000)}...` : plan

    const remoteRunLinkRegex = /^(.*app\.terraform\.io\/app.*)$/m
    const remoteRunLinkMatch = remoteRunLinkRegex.exec(plan)
    const remoteRunLink = remoteRunLinkMatch !== null ? remoteRunLinkMatch[1] : null

    const output = `#### [\`${stackName}\`] Terraform Plan 📖\`${steps.plan.outcome}\`

        ${remoteRunLink ? `<a href="${remoteRunLink}" target="_blank">Remote Plan Link ↗️</a>` : ""}

        <details><summary>Show Plan</summary>

        \`\`\`tf
        ${plan}
        \`\`\`

        </details>

        *Pusher: @${github.actor}, Action: \`${github.event_name}\`, Working Directory: \`${context.env.tf_actions_working_dir}\`, Workflow: \`${github.workflow}\`*`;

    github.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: output
    })
}