const request = require('request-promise')
const fs = require('fs-extra')
const glob = require('glob')

const { sleep } = require('./utils')
const config = require('./config')

const api = `${config.target.baseUrl}/${config.target.org}/${config.target.repo}`

/* Setting the headers for the request. */
const headers = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'node.js'
}
if (config.target.token) {
  headers['Authorization'] = `token ${config.target.token}`
}

/**
 * It reads the state.json file, updates the issue number, and writes the file back to disk
 * @param issue - The issue object from the GitHub API.
 */
const bumpIssueCount = (issue) => {
  const state = JSON.parse(fs.readFileSync(`./${config.source.repo}/state.json`))

  state.updateIssue = issue.number
  fs.writeFileSync(`./${config.source.repo}/state.json`, JSON.stringify(state, null, '  '))
}

/**
 * It makes a PATCH request to the given url with the given body
 * @param url - The URL to make the request to.
 * @param body - The body of the request.
 * @returns A promise that resolves to the response from the server.
 */
const patch = async (url, body) => {
  return request({
    method: 'PATCH',
    headers,
    url,
    body,
    json: true
  })
}

/**
 * It takes an issue number and the current state of the issue, and returns a boolean indicating
 * whether the issue state has changed
 * @param issueNumber - The issue number of the issue you want to check.
 * @param currentState - The current state of the issue.
 * @returns A boolean value
 */
const hasIssueStateChanged = async (issueNumber, currentState) => {
  const url = `${api}/repos/${config.target.org}/${config.target.repo}/issues/${issueNumber}`
  let hasChanged = false
  try {
    const response = await request({
      method: 'GET',
      headers,
      url,
      json: true,
    })
    if (response.state !== currentState) {
      hasChanged = true
    }
  } catch (error) {
    console.error(error)
  }
  return hasChanged
}


/**
 * It takes an issue object, updates the state and labels, and then bumps the issue count
 * @param issue - The issue object from the Github API
 */
const updateIssue = async (issue) => {
  const url = `${api}/issues/${issue.number}`
  const body = {
    state: issue.state,
    labels: (issue.labels || []).concat(['Github Import'])
  }
  await patch(url, body)
    .then(response => {
      console.log(`Set issue #${issue.number} state to ${issue.state}`)
      return response
    })
    .catch()
  await bumpIssueCount(issue)
}

const main = async () => {
  const issues = glob.sync(`${config.source.repo}/issues/issue-+([0-9]).json`)
    .map(file => JSON.parse(fs.readFileSync(file)))
    .sort((a, b) => a.number - b.number)
  const state = JSON.parse(await fs.readFile(`./${config.source.repo}/state.json`))
  for (let issue of issues) {
    if (issue.number <= (state.updateIssue || 0)) {
      console.log(`Skipping ${issue.number}. Already processed`)
    } else {
      currentState = issue.state
      await updateIssue(issue)
      while (await hasIssueStateChanged(issue.number, currentState)) {
        console.log(`Waiting for issue #${issue.number} to update`)
        await sleep(1000)
      }

    }
  }
}

main()
