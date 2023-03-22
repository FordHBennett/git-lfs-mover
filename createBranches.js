/* Importing the required modules. */
const request = require('request-promise')
const fs = require('fs-extra')
const glob = require('glob')

const { sleep } = require('./utils')
const config = require('./config')
const api = `${config.target.baseUrl}/${config.target.org}/${config.target.repo}`

const headers = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'node.js'
}
if (config.target.token) {
  headers['Authorization'] = `token ${config.target.token}`
}


/**
 * It creates a branch on the repository with the name `pr<issue number>base` and sets the head of the
 * branch to the base branch of the pull request
 * @param issue - the issue object from the webhook
 */
const createBranch = async (issue) => {
  const ref = `refs/heads/pr${issue.number}base`
  console.log(issue.base.sha);
  await request({
    method: 'POST',
    headers,
    url: `${api}/git/refs`,
    body: {
      ref,
      sha: issue.base.sha,
    },
    json: true,
  }).catch(err => {
    console.log(`Unable to create ref: ${ref}`)
    console.log(err.message)
  })
}

/**
 * It checks if a branch exists for a given issue
 * @param issue - the issue object from the GitHub API
 * @returns A boolean value
 */
const isBranchMade = async (issue) => {
  const url = `${api}/branches/pr${issue.number}base`
  let exists = true
  try {
    await request({
      method: 'GET',
      headers,
      url,
      json: true,
    })
  } catch (error) {
    exists = false
  }
  return exists
}

/**
 * It creates a branch for each issue that has a base branch
 */
const main = async () => {
  const issues = glob.sync(`${config.source.repo}/issues/issue-+([0-9]).json`)
    .map(file => JSON.parse(fs.readFileSync(file)))
    .sort((a, b) => a.number - b.number)
  for (let issue of issues) {
    if (issue.base) {
      console.log(`Creating branch for PR-${issue.number}`)
      await createBranch(issue)
     let branchExists = await isBranchMade(issue)
      while (!branchExists) {
        console.log(`Waiting for branch pr${issue.number}base to exist`)
        await sleep(1000)
        branchExists = await isBranchMade(issue)
      }
      await sleep(1000)
    }
  }
}

main()
