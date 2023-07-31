/* Importing the required libraries. */
const request = require('request-promise')
const fs = require('fs-extra')
const { spawnSync } = require("child_process");

/* Importing the config file and setting up the variables for the repo, source, repoPath, and pageSize. */
const config = require('./config')
const repo = config.source.repo
const source = `${config.source.baseUrl}/${config.source.org}/${config.source.repo}`
const repoPath = `${config.source.repo}/.git`;
const pageSize = 100

/* This is setting up the headers for the request. */
const headers = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'node.js'
}
if (config.source.token) {
  headers['Authorization'] = `token ${config.source.token}`
}

/**
 * It takes a list id and returns a function that takes a page number and returns a promise that
 * resolves to the JSON response of the GitHub API for that list id and page number
 * @param listId - The id of the list you want to get the issues from.
 * @returns A function that takes a page number and returns a promise that resolves to an array of
 * issues.
 */
const getPage = (listId) => async (page) => {
  return JSON.parse(await request({
    headers,
    url: `${source}/${listId}?state=all&per_page=${pageSize}&page=${page}`
  }))
}


/**
 * "Fetch a list of items from a paginated API, and return the results as a single array."
 *
 * The function takes a single argument, the ID of the list to fetch. It then calls the `getPage`
 * function, which we'll define in a moment, to fetch the first page of results. It then loops, calling
 * `getPage` again to fetch the next page of results, until the number of results returned is less than
 * the page size
 * @param listId - The id of the list you want to fetch.
 * @returns An array of objects
 */
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
  } while (resultSize === pageSize)

  return results
}
// for (i = 0; i < commitsData.length; i++) {
//   if (isBadObject(commitsData[i].sha)) {
//     for (j = 0; j < commitsData[i].parents.length; j++) {
//       if (isBadObject(commitsData[i].parents[j].sha)) {
//         for (k = 0; k < commitsData[i].commit.tree.length; k++) {
//           if (isBadObject(commitsData[i].commit.tree[k].sha)) {
//             console.log(`You're fucked dude idk`);
//           }
//           else {
//             console.log(`Replacing commit.sha with commit.tree.sha`);
//             commitsData[i].sha = commitsData[i].commit.tree[k].sha;
//           }
//         }
//       }
//       else {
//         console.log(`Replacing commit.sha with commit.tree.sha`);
//         commitsData[i].sha = commitsData[i].parents[j].sha;
//         for (k = 0; k < commitsData[i].commit.tree.length; k++) {
//           if (isBadObject(commitsData[i].commit.tree[k].sha)) {
//             console.log(`Replacing commit.tree.sha with commit.parents.sha`);
//             commitsData[i].commit.tree[k].sha = commitsData[i].parents[j].sha;
//           }
//         }
//       }
//     }
//   }
//   else {
//     for (j = 0; j < commitsData[i].parents.length; j++) {
//       if (isBadObject(commitsData[i].parents[j].sha)) {
//         console.log(`Replacing commit.parents.sha with commit.sha`);
//         commitsData[i].parents[j].sha = commitsData[i].sha;
//       }
//     }
//     for (k = 0; k < commitsData[i].commit.tree.length; k++) {
//       if (isBadObject(commitsData[i].commit.tree[k].sha)) {
//         console.log(`Replacing commit.tree.sha with commit.sha`);
//         commitsData[i].commit.tree[k].sha = commitsData[i].sha;
//       }
//     }
//   }
// }

// return commitsData
// }

/**
 * It returns true if the result of a git command contains the string "fatal: bad object"
 * @param result - The result of the git command.
 * @returns The result of the command
 */
const isBadObject = (result) => {
  return result.stderr.toString("utf-8").includes("fatal: bad object")
}

/**
 * If the commit hash is bad, then get the list of commits in the PR, and check each one until you find
 * a good one
 * @param issue - the issue object
 * @param which - the branch that we're checking the commit hash for.
 */
const checkCommitHash = async (issue, which) => {
  const commit_result = spawnSync("git", ["show", issue[which].sha], { cwd: repoPath });
  if (isBadObject(commit_result)) {
    const prCommits = await fetchList(`pulls/${issue.number}/commits`)
    const parent_commits = prCommits.map(commit => commit.sha)
    for (let commit of parent_commits.reverse()) {
      const commit_result = spawnSync("git", ["show", commit], { cwd: repoPath });
      if (!(isBadObject(commit_result))) {
        issue[which].sha = commit;
        break;
      }
    }
  }
}

/**
 * It fetches all issues and pull requests, then fetches all reviews and comments for each pull
 * request, and finally returns all of that data
 * @returns An object with three properties: issues, reviews, and comments.
 */
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
        checkCommitHash(issue, "base")
      }
      issue.head = pr.head
      checkCommitHash(issue, "head")
      issue.merged_at = pr.merged_at
    }
  }
  return { issues, reviews, comments }
}


/**
 * It takes an array of issues, and writes each issue to a file in the `issues` directory
 * @param issues - The array of issues to write to disk.
 */
const writeIssues = async (issues) => {
  await fs.ensureDir(`${repo}/issues`)
  for (let issue of issues) {
    const fileName = `${repo}/issues/issue-${issue.number}.json`
    await fs.writeFile(fileName, JSON.stringify(issue, null, '  '))
  }
}

/**
 * It takes a name and returns a function that takes an array of items and writes them to a file
 * @param name - The name of the file to write to.
 * @returns A function that takes an array of items and writes them to a file.
 */
const writeList = (name) => (items) => {
  const fileName = `${repo}/${name}.json`
  return fs.writeFile(fileName, JSON.stringify(items, null, '  '))
}

/**
 * It fetches all the issues, reviews, and comments, and writes them to the file system
 */
const main = async () => {
  await fs.ensureDir(repo)

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
  ].map(({ listId, fileName }) => {
    return fetchList(listId)
      .then(writeList(fileName))
  }))
}

main().catch(console.error)
