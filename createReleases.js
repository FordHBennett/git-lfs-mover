const request = require('request-promise')
const fs = require('fs-extra')

const config = require('./config')
const api = `${config.target.baseUrl}/${config.target.org}/${config.target.repo}`

const headers = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'node.js'
}
if (config.target.token) {
  headers['Authorization'] = `token ${config.target.token}`
}

/**
 * It takes a release object, logs the tag name, and then creates a release on GitHub
 * @param release - {
 */
const createRelease = async (release) => {
  console.log(`Creating Release: ${release.tag_name}`)
  await request({
    method: 'POST',
    headers,
    url: `${api}/releases`,
    body: {
      tag_name: release.tag_name,
      target_commitish: release.target_commitish,
      name: release.name,
      body: release.body,
      draft: release.draft,
      prerelease: release.prerelease,
    },
    json: true,
  }).catch(err => {
    console.log(`Unable to create release: ${release.tag_name}`)
    console.log(err.message)
  })
}

const main = async () => {
  const releases = JSON.parse(await fs.readFile(`${config.source.repo}/releases.json`))
  console.log(`Releases to create: ${releases.length}`)

  for (let release of releases) {
    await createRelease(release, releases)
  }
}

main().catch(console.error)
