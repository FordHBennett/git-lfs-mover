/* Importing the libraries that we need to use in our code. */
const request = require('request-promise')
const fs = require('fs-extra')
const glob = require('glob')

const { sleep } = require('./utils')
const config = require('./config')
const createMessage = require('./createMessage')
const processImages = require('./processImages')

const api = `${config.target.baseUrl}/${config.target.org}/${config.target.repo}`
if (!fs.pathExistsSync(`./${config.source.repo}/state.json`)) {
  console.log('Creating state file')

  fs.writeFileSync(`./${config.source.repo}/state.json`, '{}')
}

/* This is setting up the headers for the request. */
const headers = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'node.js'
}
if (config.target.token) {
  headers['Authorization'] = `token ${config.target.token}`
}

/**
 * It reads the state.json file, increments the issue number, and writes the state.json file back to
 * disk
 * @param issue - The issue object from the GitHub API
 */
const bumpIssueCount = (issue) => {
  const state = JSON.parse(fs.readFileSync(`./${config.source.repo}/state.json`))

  state.issue = issue.number
  fs.writeFileSync(`./${config.source.repo}/state.json`, JSON.stringify(state, null, '  '))
}

/**
 * It logs an error message to the console and exits the program
 * @param issue - The issue object from the source repo
 * @param err - The error message returned by the GitHub API
 */
const logError = (issue, err) => {
  console.log(`Could not create issue: ${issue.number}`)
  console.log(`Message: ${err}`)
  console.log(`To continue, manually create an issue on your target repo and increment the 'issue' in ./${config.source.repo}/state.json`)
  process.exit(1)
}

/**
 * It checks if an issue exists in the repository
 * @param issue - the issue object that we're going to create
 * @returns A boolean value
 */
const isIssueMade = async (issue) => {
  const url = `${api}/issues/${issue.number}`
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
 * It creates an issue on GitHub
 * @param issue - The issue object from the JSON file
 */
const createIssue = async (issue) => {
  console.log(`Creating issue: ${issue.number}`)
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  await request({
    method: 'POST',
    headers,
    url: `${api}/issues`,
    body: {
      title: issue.title,
      body: `${createMessage(issue)}\n\n${await processImages(issue.body)}`,
    },
    json: true,
  })
  .then(response => {
    bumpIssueCount(issue)
    return response
  })
  .catch(async err => {
    console.log('Error creating issue:', err);

    await delay(10 * 60 * 1000); // Delay for 10 minutes

    console.log('Retrying...');
    await createIssue(issue);
  })
}

//isPullRequestMade is the same function as isIssueMade
//In the future, we can refactor this to be one function
/**
 * It checks if a pull request exists for a given issue
 * @param issue - The issue object that we're checking to see if a pull request has been made for.
 * @returns A boolean value
 */
const isPullRequestMade = async (issue) => {
  const url = `${api}/issues/${issue.number}`
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
 * It creates a pull request on the target repository
 * @param pull - The pull request object from the source repo
 */
const createPull = async (pull) => {
  console.log(`Creating pull: ${pull.number}`)
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const body =
  {
    title: pull.title,
    repo: `${config.target.repo}`,
    body: `${createMessage(pull)}\n\n${await processImages(pull.body)}`,
    head: pull.base.sha === pull.head.sha ? 'refs/heads/master' : `pr${pull.number}head`,
    base: `pr${pull.number}base`,
    maintainer_can_modify: true,
  }
  await request({
    method: 'POST',
    headers,
    url: `${api}/pulls`,
    body,
    json: true,
  })
  .then(response => {
    bumpIssueCount(pull)
    return response
  })
  .catch(async (err) => {
    console.log('Error creating pull:', err);

    await delay(10 * 60 * 1000); // Delay for 10 minutes

    console.log('Retrying...');
    await createPull(pull);
  })
}

const main = async () => {
  const issues = glob.sync(`${config.source.repo}/issues/issue-+([0-9]).json`)
    .map(file => JSON.parse(fs.readFileSync(file)))
    .sort((a, b) => a.number - b.number)

  const state = JSON.parse(await fs.readFile(`./${config.source.repo}/state.json`))
  for (let issue of issues) {
    if (issue.number <= (state.issue || 0)) {
      // we already processed this issue
      console.log(`Skipping ${issue.number}. Already processed`)
    }
    else if (issue.html_url.includes('pull')) {
      /* This is checking if the issue is a pull request. If it is, it creates a pull request on the
      target repository. */
      await createPull(issue)
      await sleep(200)
      let pullExists = await isPullRequestMade(issue)
      while (!pullExists) {
        console.log(`Waiting for issue ${issue.number} to exist`)
        await sleep(200)
        pullExists = await isPullRequestMade(issue)
      }
    } else {
      /* Checking if the issue is a pull request. If it is, it creates a pull request on the
      target repository. */
      await createIssue(issue)
      await sleep(200)
      let issueExists = await isIssueMade(issue)
      while (!issueExists) {
        console.log(`Waiting for pull ${issue.number} to exist`)
        await sleep(200)
        issueExists = await isIssueMade(issue)
      }
    }
  }
}

main().catch(console.error)
