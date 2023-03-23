const request = require('request-promise')
const fs = require('fs-extra')

const { sleep } = require('./utils')
const config = require('./config')
const createMessage = require('./createMessage')
const processImages = require('./processImages')

const api = `${config.target.baseUrl}/${config.target.org}/${config.target.repo}`
//dummy commit to use when the commit is not found
const dummyCommit =  `af38187693cd4b51d19d07681e962c0f74eb662b`

/* This is setting up the headers for the request. */
const headers = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'node.js'
}
if (config.target.token) {
  headers['Authorization'] = `token ${config.target.commentToken || config.target.token}`
}

/**
 * It makes a POST request to the given url with the given body, and returns the response
 * @param url - The URL to make the request to.
 * @param body - The body of the request.
 * @returns A promise
 */
const post = async (url, body) => {
  return request({
    method: 'POST',
    headers,
    url,
    body,
    json: true
  })
}

let commits = []

/**
 * It checks if a commit exists in the commits.json file
 * @param sha - The commit SHA
 * @returns A boolean value.
 */
const commitExists = async (sha) => {
  if (!commits.length) {
    commits = JSON.parse(await fs.readFile(`${config.source.repo}/commits.json`))
  }

  return !!commits.find(commit => commit.sha === sha)
}

/**
 * It takes an ID and a boolean, and if the boolean is true, it adds the ID to the state file
 * @param id - The id of the comment to set as processed
 * @param [newId=true] - If the comment is a new comment, it will be set to true. If it's an edited
 * comment, it will be set to false.
 */
const setCommentProcessed = async (id, newId = true) => {
  console.log(`Setting ${id} as processed`)
  const state = JSON.parse(await fs.readFile(`./${config.source.repo}/state.json`))

  state.comments = state.comments || {}
  state.comments[id] = newId
  await fs.writeFile(`./${config.source.repo}/state.json`, JSON.stringify(state, null, '  '))
}

/**
 * It takes an id and a boolean, and if the boolean is true, it sets the id as processed in the
 * state.json file
 * @param id - The id of the review.
 * @param [newId=true] - If the review is a new review, then we'll set this to true. If it's an
 * existing review, then we'll set this to false.
 */
const setReviewProcessed = async (id, newId = true) => {
  console.log(`Setting ${id} as processed`)
  const state = JSON.parse(await fs.readFile(`./${config.source.repo}/state.json`))

  state.reviews = state.reviews || {}
  state.reviews[id] = newId
  await fs.writeFile(`./${config.source.repo}/state.json`, JSON.stringify(state, null, '  '))
}

/**
 * It checks if a comment has already been processed
 * @param id - The id of the comment to check
 * @returns A boolean value.
 */
const isCommentProcessed = async (id) => {
  const state = JSON.parse(await fs.readFile(`./${config.source.repo}/state.json`))

  return !!(state.comments || {})[id]
}

/**
 * It reads the state file, and returns true if the review with the given ID has already been processed
 * @param id - The ID of the review.
 * @returns A boolean value.
 */
const isReviewProcessed = async (id) => {
  const state = JSON.parse(await fs.readFile(`./${config.source.repo}/state.json`))

  return !!(state.reviews || {})[id]
}

/**
 * If the comment has a state property, it's a review comment, if it has a pull_request_url property,
 * it's a pull request comment, and if it has a commit_id property but no pull_request_url property,
 * it's a commit comment
 */
const isReviewComment = comment => !!comment.state
const isPullRequestComment = comment => !!comment.pull_request_url
const isCommitComment = comment => !!comment.commit_id && !comment.pull_request_url

/**
 * It logs an error message to the console
 * @param comment - The comment object that was created
 * @param err - The error message
 */
const logError = (comment, err) => {
  console.log(`Could not create comment: ${comment.id}`)
  console.log(`Message: ${err}`)
}
/**
 * It creates a comment
 * @param comment - The comment object from the GitHub API
 * @param comments - The comments array from the GitHub API response
 */

const createComment = async (comment, comments) => {
  const { id } = comment
  if (isReviewComment(comment)) {
    await createReview(comment)
  } else if (isPullRequestComment(comment)) {
    await createPullRequestComment(comment, comments)
  } else if (isCommitComment(comment)) {
    await createCommitComment(comment, comments)
  } else {
    await createIssueComment(comment)
  }
}

/**
 * It takes a state and returns an event
 * @param state - The current state of the pull request.
 * @returns The event that is being returned is the event that is being passed in.
 */
const getEvent = (state) => {
  switch(state) {
    case 'APPROVED':
      return 'APPROVE'
    case 'CHANGES_REQUESTED':
      return 'REQUEST_CHANGES'
    default:
      return ''
  }
}

/**
 * It creates a review on a pull request if the review has not already been processed and the review is
 * not a comment or a dismissed review
 * @param comment - The comment object from the GitHub API
 */
const createReview = async (comment) => {
  const { id } = comment

  if (await isReviewProcessed(id)) {
    console.log(`Review ${id} already processed`)
  } else if (comment.state === 'COMMENTED') {
    console.log(`Review ${id} is a comment - skipping`)
  } else if (comment.state === 'DISMISSED') {
    console.log(`Review ${id} was dismissed - skipping`)
  } else {
    const number = comment.pull_request_url.split('/').pop()
    const url = `${api}/pulls/${number}/reviews`
    const event = getEvent(comment.state)
    if (event) {
      const body = {
        commit_id: comment.commit_id,
        body: comment.body,
        event,
        comments: []
      }
      await post(url, body)
        .then(async response => {
          await setReviewProcessed(id, response.id)
          return response
        })
        .catch(err => {
          console.log(`Could not create review ${id}`)
          logError(comment, err)
        })
    } else {
      console.log(`Review ${id} has no event type ${comment} - skipping`)
    }
  }
}

/**
 * It checks if a comment exists on a pull request
 * @param pullRequestId - The ID of the pull request you want to check.
 * @param commentId - The ID of the comment you want to check.
 * @returns A boolean value
 */
const isPullRequestCommentMade = async (pullRequestId, commentId) => {
  const url = `${api}/repos/${config.target.org}/${config.target.repo}/pulls/${pullRequestId}/comments/${commentId}`
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
 * It checks if the comment has already been processed, if not it processes the comment and adds it to
 * the pull request
 * @param comment - The comment object from the source repo
 * @param [comments] - An array of comments that are replies to the comment being created.
 */
const createPullRequestComment = async (comment, comments = []) => {
  const { id } = comment
  const issueNumber = comment.pull_request_url.split('/').pop()
  const url = `${api}/pulls/${issueNumber}/comments`
  if (await isCommentProcessed(id)) {
    console.log(`Comment ${id} already processed`)
  } else {
    const commentBody = await processImages(comment.body)
    console.log(`Adding comment ${id} to ${url}`)
    let body
    const reply = comments.find(c => c.original_commit_id === comment.original_commit_id && c.original_position === comment.original_position && c.diff_hunk === comment.diff_hunk)
    if (reply) {
      const state = JSON.parse(await fs.readFile(`./${config.source.repo}/state.json`))
      body = {
        body: `${createMessage(comment)}\n\n\n${commentBody}`,
        in_reply_to: (state.comments || {})[reply.id],
      }
    } else {
      body = {
        body: `${createMessage(comment)}\n\n\n${commentBody}`,
        commit_id: comment.original_commit_id,
        path: comment.path,
        position: comment.original_position,
      }
    }
    await post(url, body)
      .then(async response => {
        await setCommentProcessed(id, response.id)
      })
      .catch(err => {
        console.log(`Commit ${comment.original_commit_id} no longer exists`)
        const body = {
          body: `${createMessage(comment)}\n> **Outdated (history rewrite)** - original diff\n---\n\`\`\`diff\n${comment.diff_hunk}\n\`\`\`\n\n\n${commentBody}`,
          commit_id: comment.commit_id,
          path: comment.path,
          position: comment.position == null ? comment.original_position : comment.position,
        }
        return post(url, body)
          .then(async response => {
            await setCommentProcessed(id, response.id)
          })
          .catch(async err => {
            if (err.error && err.error && err.error.errors && err.error.errors[0].field) {
              console.log(`Commit ${comment.commit_id} no longer exists (someone did a force push)`)
              console.log('Skipping')
            } else {
              logError(comment, err)
            }
            await setCommentProcessed(id, true)
          })
      })
    pullCommentExists = await isPullRequestCommentMade(comment.pull_request_review_id, comment.commentId)
    while (!pullCommentExists) {
      await sleep(1000)
      pullCommentExists = await isPullRequestCommentMade(comment.pull_request_review_id, comment.commentId)
    }
  }
}

/**
 * It checks if a comment exists on a commit
 * @param commitSha - The commit SHA of the commit you want to check for a comment.
 * @param commentId - The ID of the comment you want to check.
 * @returns A boolean value.
 */
const isCommitCommentMade = async (commitSha, commentId) => {
  const url = `${api}/repos/${config.target.org}/${config.target.repo}/commits/${commitSha}/comments/${commentId}`
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
 * It checks if the comment has already been processed, if not, it checks if the commit still exists,
 * if it does, it adds the comment to the commit, if not, it adds the comment to a dummy commit
 * @param comment - The comment object from the database
 */
const createCommitComment = async (comment) => {
  const { id } = comment
	const sha = comment.commit_id;
  const url = `${api}/commits/${sha}/comments`
  const commentBody = await processImages(comment.body)

  if (await isCommentProcessed(id)) {
    console.log(`Comment ${id} already processed`)
  } else if (!await commitExists(sha)) {
    //console.log(`Commit ${sha} no longer exists`)
    console.log(`Adding comment ${id} to ${url}`)
    const body = {
      body: `${createMessage(comment)}\n\n\n${commentBody}`,
      dummyCommit,
      path: comment.path,
      position: comment.position
    }
  } else {
    console.log(`Adding comment ${id} to ${url}`)
    const body = {
      body: `${createMessage(comment)}\n\n\n${commentBody}`,
      sha,
			path: comment.path,
			position: comment.position
    }

    await post(url, body)
      .then(async response => {
        await setCommentProcessed(id, response.id)

        return response
      })
      .catch(err => {
        logError(comment, err)
      })

    commitCommentExists = await isCommitCommentMade(sha, id)
    while (!commitCommentExists) {
      await sleep(1000)
      commitCommentExists = await isCommitCommentMade(sha, id)
    }
  }
}

/**
 * It checks if a comment exists on an issue
 * @param issue - the issue object from the GitHub API
 * @param commentId - The ID of the comment you want to check for.
 * @returns A boolean value.
 */
const isIssueCommentMade = async (issue, commentId) => {
  const url = `${api}/repos/${config.target.org}/${config.target.repo}/issues/${issue.number}/comments/${commentId}`
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
 * It checks if the comment has already been processed, if not it adds it to the issue
 * @param comment - The comment object from the GitHub API
 */
const createIssueComment = async (comment) => {
  const { id } = comment
  const issueNumber = comment.issue_url.split('/').pop()
  const url = `${api}/issues/${issueNumber}/comments`
  const commentBody = await processImages(comment.body)

  if (await isCommentProcessed(id)) {
    console.log(`Comment ${id} already processed`)
  } else {
    console.log(`Adding comment ${id} to ${url}`)
    const body = {
      body: `${createMessage(comment)}\n\n\n${commentBody}`
    }
    await post(url, body)
      .then(async response => {
        await setCommentProcessed(id, response.id)

        return response
      })
      .catch(err => {
        logError(comment, err)
      })
    issueCommentExists = await isIssueCommentMade(issue, id)
    while (!issueCommentExists){
      await sleep(1000)
      issueCommentExists = await isIssueCommentMade(issue, id)
    }
  }
}

const main = async () => {
  const issueComments = JSON.parse(await fs.readFile(`${config.source.repo}/issue-comments.json`))
  const commitComments = JSON.parse(await fs.readFile(`${config.source.repo}/comments.json`))
  const pullComments = JSON.parse(await fs.readFile(`${config.source.repo}/pull-comments.json`))
  const reviewComments = JSON.parse(await fs.readFile(`${config.source.repo}/review-comments.json`))
  const reviews = JSON.parse(await fs.readFile(`${config.source.repo}/reviews.json`))
  const comments = []
    .concat(issueComments, commitComments, pullComments, reviewComments, reviews)
    .sort((a, b) => (a.created_at || a.submitted_at) > (b.created_at || b.submitted_at) ? 1 : -1)

  console.log(`Comments to process: ${comments.length}`)

  let processed = 0
  for (let comment of comments) {
    process.stdout.write(`\r Comments remaining:${((comments.length - processed) / comments.length).toFixed(2)}% `);
    await createComment(comment, comments)
    processed++
  }


}

main().catch(console.error)
