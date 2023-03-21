const request = require('request-promise')
const fs = require('fs-extra')
const glob = require('glob')
const { spawnSync } = require("child_process");

const config = require('./config')

const repo = config.source.repo
const source = `${config.source.baseUrl}/${config.source.org}/${config.source.repo}`
const target = `${config.target.baseUrl}/${config.target.org}/${config.target.repo}`
const repoPath = `${config.source.repo}/.git`;
const pageSize = 100

const headers = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'node.js'
}
if (config.source.token) {
  headers['Authorization'] = `token ${config.source.token}`
}

const getPage = (listId) => async (page) => {
  return JSON.parse(await request({
    headers,
    url: `${source}/${listId}?state=all&per_page=${pageSize}&page=${page}`
  }))
}

const fetchList = async (listId) => {
  let pageNumber = 1
  let results = []
  let resultSize = 0
  const getListPage = getPage(listId)

  do {
    console.log(`Fetching page ${pageNumber} of ${listId}`)
    const response = await getListPage(pageNumber)
    results = results.concat(response)
    resultSize = response.length
    pageNumber++
  } while(resultSize === pageSize)

  return results
}

const fetchIssues = async () => {
  const issues = await fetchList('issues')
  const pulls = await fetchList('pulls')
  let reviews = []
  let comments = []

  for (let issue of issues) {
    if (issue.pull_request) {
      const pr = pulls.find(pull => pull.number === issue.number)
      const prReviews = await fetchList(`pulls/${issue.number}/reviews`)
      for (let review of prReviews) {
        const reviewComments = await fetchList(`pulls/${issue.number}/reviews/${review.id}/comments`)
        review.comments = reviewComments
        comments = comments.concat(reviewComments)
      }
      reviews = reviews.concat(prReviews)
      if (pr) {
        issue.base = pr.base
        const base_result = spawnSync("git", ["show", issue.base.sha], { cwd: repoPath });
        if (base_result.stderr.toString("utf-8").includes("fatal: bad object")) {
         const prCommits = await fetchList(`pulls/${issue.number}/commits`)
         const parent_base_commits = prCommits.lmap(commit => commit.sha)
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
        const head_result = spawnSync("git", ["show", issue.head.sha], { cwd: repoPath });
        if (head_result.stderr.toString("utf-8").includes("fatal: bad object")) {
          const prCommits = await fetchList(`pulls/${issue.number}/commits`)
          const parent_head_commits = prCommits.map(commit => commit.sha)
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
