/* Importing the required modules. */
const request = require('request-promise')
const fs = require('fs-extra')
const glob = require('glob')

/* Importing the sleep function from the utils file and the config file. */
const { sleep } = require('./utils')
const config = require('./config')
const api = `${config.target.baseUrl}/${config.target.org}/${config.target.repo}`

/* Creating a header object that will be used in the request. */
const headers = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'node.js'
}
if (config.target.token) {
  headers['Authorization'] = `token ${config.target.token}`
}



/**
 * It creates a branch on the repository
 * @param issue - the issue object
 * @param which - This is the branch name.
 */
const createBranch = async (issue, which) => {
  const ref = `refs/heads/pr${issue.number}${which}`
  console.log(issue.which.sha);
  await request({
    method: 'POST',
    headers,
    url: `${api}/git/refs`,
    body: {
      ref,
      sha: issue.which.sha,
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
const isBranchMade = async (issue, which) => {
  const url = `${api}/branches/pr${issue.number}${which}`
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
 * It takes all the issues in the `issues` folder, sorts them by number, and then creates a branch for
 * each issue
 */
const main = async () => {
  const issues = glob.sync(`${config.source.repo}/issues/issue-+([0-9]).json`)
    .map(file => JSON.parse(fs.readFileSync(file)))
    .sort((a, b) => a.number - b.number)
  for (let issue of issues) {
/* Checking if the issue has a base. If it does, it will create a branch for the issue. */
    if (issue.base) {
      console.log(`Creating branch for PR-${issue.number}`)
      await createBranch(issue, 'base')
      while (!(isBranchMade(issue, 'base'))) {
        console.log(`Waiting for branch pr${issue.number}base to exist`)
        await sleep(1000)
      }
      await sleep(1000)
    }
/* Creating a branch for the head of the issue. */
    else if (issue.head) {
      console.log(`Creating branch for PR-${issue.number}`)
      await createBranch(issue,'head')
      while (!(await isBranchMade(issue, 'head'))) {
        console.log(`Waiting for branch pr${issue.number}head to exist`)
        await sleep(1000)
      }

    }
  }
}

main()
