const request = require('request-promise')
const fs = require('fs-extra')
const glob = require('glob')
const { spawnSync } = require("child_process");

const config = require('./config')

// Define source and target URLs
const repo = config.source.repo
const source = `${config.source.baseUrl}/${config.source.org}/${config.source.repo}`
const target = `${config.target.baseUrl}/${config.target.org}/${config.target.repo}`

// Path to the git repository
const repoPath = `${config.source.repo}/.git`;

// Number of items to fetch per page
const pageSize = 100

// HTTP headers for the API requests
const headers = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'node.js'
}

// If an access token is provided, include it in the headers
if (config.source.token) {
  headers['Authorization'] = `token ${config.source.token}`
}

// Returns a function that fetches a page of results for a given list
const getPage = (listId) => async (page) => {
  return JSON.parse(await request({
    headers,
    url: `${source}/${listId}?state=all&per_page=${pageSize}&page=${page}`
  }))
}

// Fetches all items for a given list
const fetchList = async (listId) => {
  let pageNumber = 1
  let results = []
  let resultSize = 0
  const getListPage = getPage(listId)

  // Keep fetching pages until we get an empty page
  do {
    console.log(`Fetching page ${pageNumber} of ${listId}`)
    const response = await getListPage(pageNumber)
    results = results.concat(response)
    resultSize = response.length
    pageNumber++
  } while(resultSize === pageSize)

  return results
}

// This function fetches issues and pulls from an API and adds additional information
// to the issues based on the corresponding pull requests, such as base, head, and merged_at.
const fetchIssues = async () => {
  // Fetches a list of issues and pulls from the API.
  const issues = await fetchList('issues')
  const pulls = await fetchList('pulls')

  // Initializes arrays for reviews and comments.
  let reviews = []
  let comments = []

  // Loops through each issue in the issues array.
  for (let issue of issues) {
    // If the issue is a pull request, find the corresponding pull request in the pulls array.
    if (issue.pull_request) {
      const pr = pulls.find(pull => pull.number === issue.number)
      // Fetches a list of reviews for the pull request.
      const prReviews = await fetchList(`pulls/${issue.number}/reviews`)

      // Loops through each review for the pull request.
      for (let review of prReviews) {
        // Fetches a list of comments for the review.
        const reviewComments = await fetchList(`pulls/${issue.number}/reviews/${review.id}/comments`)
        // Adds the comments to the review object.
        review.comments = reviewComments
        // Concatenates the comments array with the comments from the review.
        comments = comments.concat(reviewComments)
      }
      // Concatenates the reviews array with the reviews for the pull request.
      reviews = reviews.concat(prReviews)

      // If the pull request exists, add base, head, and merged_at information to the issue.
      if (pr) {
        issue.base = pr.base
        // Checks if the base sha exists in the repo.
        const base_result = spawnSync("git", ["show", issue.base.sha], { cwd: repoPath });
        // If the base sha doesn't exist, find the parent commit of the base sha that exists.
        if (base_result.stderr.toString("utf-8").includes("fatal: bad object")) {
          const prCommits = await fetchList(`pulls/${issue.number}/commits`)
          const parent_base_commits = prCommits.map(commit => commit.sha)
          // Loops through the parent base commits in reverse order to find the first one that exists.
          for(commit of parent_base_commits.reverse())
          {
            const commit_result = spawnSync("git", ["show", commit], { cwd: repoPath });
            if (!(commit_result.stderr.toString("utf-8").includes("fatal: bad object")))
            {
              issue.base.sha = commit;
              break;
            }
          }
        }

        issue.head = pr.head
        // Checks if the head sha exists in the repo.
        const head_result = spawnSync("git", ["show", issue.head.sha], { cwd: repoPath });
        // If the head sha doesn't exist, find the parent commit of the head sha that exists.
        if (head_result.stderr.toString("utf-8").includes("fatal: bad object")) {
          const prCommits = await fetchList(`pulls/${issue.number}/commits`)
          const parent_head_commits = prCommits.map(commit => commit.sha)
          // Loops through the parent head commits in reverse order to find the first one that exists.
          for(commit of parent_head_commits.reverse())
          {
            const commit_result = spawnSync("git", ["show", commit], { cwd: repoPath });
            if (!(commit_result.stderr.toString("utf-8").includes("fatal: bad object")))
            {
              issue.head.sha = commit;
              break;
            }
          }
        }
        issue.merged_at = pr.merged_at
      }
    }
  }

  return { issues, reviews, comments }
}

/**
 *
 * @param {{}[]} issues
 * @param {{}[]} pulls
 */
const writeIssues = async (issues) => {
  await fs.ensureDir(`${repo}/issues`)
  for (let issue of issues) {
    const fileName = `${repo}/issues/issue-${issue.number}.json`
    await fs.writeFile(fileName, JSON.stringify(issue, null, '  '))
  }
}

const writeList = (name) => (items) => {
  const fileName = `${repo}/${name}.json`
  return fs.writeFile(fileName, JSON.stringify(items, null, '  '))
}

const main = async () => {
  await fs.ensureDir(repo)

  // get all the issues
  const { issues, reviews, comments } = await fetchIssues()
  await writeIssues(issues)
  await writeList('reviews')(reviews)
  await writeList('review-comments')(comments)

  await Promise.all([
    { listId: 'pulls/comments', fileName: 'pull-comments' },
    { listId: 'comments', fileName: 'comments' },
    { listId: 'issues/comments', fileName: 'issue-comments' },
    { listId: 'commits', fileName: 'commits' },
    { listId: 'releases', fileName: 'releases' },
  ].map(({ listId, fileName}) => {
    return fetchList(listId)
      .then(writeList(fileName))
  }))
}

main().catch(console.error)
