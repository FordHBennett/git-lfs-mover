const request = require('request-promise')
const fs = require('fs-extra')
const glob = require('glob')

const { sleep } = require('./utils')
const config = require('./config')

const api = `${config.target.baseUrl}/${config.target.org}/${config.target.repo}`

/* Setting up the headers for the request. */
const headers = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'node.js'
}
if (config.target.token) {
  headers['Authorization'] = `token ${config.target.token}`
}

/**
 * It reads the state.json file, increments the deletedIssue property, and writes the state.json file
 * back to disk
 * @param issue - The issue object from the GitHub API.
 */
const bumpIssueCount = (issue) => {
  const state = JSON.parse(fs.readFileSync(`./${config.source.repo}/state.json`))

  state.deletedIssue = issue.number
  fs.writeFileSync(`./${config.source.repo}/state.json`, JSON.stringify(state, null, '  '))
}

/**
 * It checks if a branch exists
 * @param issue - the issue object from the webhook
 * @param which - 'base' or 'head'
 * @returns A boolean value
 */
// const isBranchDeleted = async (issue, which) => {
//   const url = `${api}/branches/pr${issue.number}${which}`
//   let exists = false
//   try {
//     await request({
//       method: 'GET',
//       headers,
//       url,
//       json: true,
//     })
//   } catch (error) {
//     exists = true
//   }
//   return exists
// }


const deleteBranch = async (issue) => {
  const baseUrl = `${api}/git/refs/heads`
  if (issue.closed_at) {
    // delete pr base
    await request.delete({
      headers,
      url: `${baseUrl}/pr${issue.number}base`,
    })
      .then(response => {
        console.log(`Deleted 'pr${issue.number}base'`)
        return response
      })
      .catch(err => {
        console.log(`Failed to delete 'pr${issue.number}base'`, err.message)
      })

    // delete pr head
    await request.delete({
      headers,
      url: `${baseUrl}/pr${issue.number}head`,
    })
      .then(response => {
        console.log(`Deleted 'pr${issue.number}head'`)
        return response
      })
      .catch(err => {
        console.log(`Failed to delete 'pr${issue.number}head'`, err.message)
      })
  }
  await bumpIssueCount(issue)
}


const main = async () => {
  const issues = glob.sync(`${config.source.repo}/issues/issue-+([0-9]).json`)
    .map(file => JSON.parse(fs.readFileSync(file)))
    .sort((a, b) => a.number - b.number)

  // console.log(issues)
  const state = JSON.parse(await fs.readFile(`./${config.source.repo}/state.json`))
  let processed = 0
  for (let issue of issues) {
    if (issue.number <= (state.deletedIssue || 0)) {
      console.log(`Skipping ${issue.number}. Already processed`)
    } else {
      process.stdout.write(`\r Branches to be deleted remaining:${((issues.length - processed) / issues.length).toFixed(2)}% `);
      await deleteBranch(issue)
      await sleep(1000)
      // while (!(await isBranchDeleted(issue, 'base'))) {
      //   console.log(`Waiting for branch pr${issue.number}base to be deleted`)
      //   await sleep(1000)
      // }
      // while (!(await isBranchMade(issue, 'head'))) {
      //   console.log(`Waiting for branch pr${issue.number}head to be deleted`)
      //   await sleep(1000)
      // }
    }
    processed++
  }
}

main()
