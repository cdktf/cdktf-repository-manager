
module.exports = ({ providerName }) => {
    const path = require('path')
    const fs = require('fs')
    const provider = require('./main/provider.json')
    const providerVersion = provider[providerName]
    const providersWithCustomRunners = require('./main/providersWithCustomRunners.json')
    const useCustomGithubRunner = providersWithCustomRunners.includes(providerName);
    const template = fs.readFileSync(path.join(process.env.GITHUB_WORKSPACE, 'main', 'projenrc.template.js'), 'utf-8')
    const projenrc = template.replace('__PROVIDER__', providerVersion).replace('__CUSTOM_RUNNER__', useCustomGithubRunner)
    fs.writeFileSync(path.join(process.env.GITHUB_WORKSPACE, 'provider', '.projenrc.js'), projenrc)
}
