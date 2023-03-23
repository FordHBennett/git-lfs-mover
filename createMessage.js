const moment = require('moment')

const users = require('./users')
const config = require('./config')

/* Formatting the date. */
const shortFormat = 'MMM D, YYYY'
const longFormat = 'dddd, MMMM Do YYYY, h:mm:ss a Z'
const formatDate = function formatDate(date) {
	const display = moment(date).format(shortFormat);
	const title = moment(date).format(longFormat);
	const html = '<time datetime="' + date + '" title="' + title + '">' + display + '</time>';
	return html;
}

/**
 * If the target has an avatarUrl, and the user is in the users array, return the avatarUrl with the
 * user's id. Otherwise, return the default avatar
 * @returns The avatar url of the user.
 */
const getAvatarUrl = user => {
  if (config.target.avatarUrl && users[user.login]) {
    return config.target.avatarUrl.replace('{id}', users[user.login].id)
  } else {
    return 'https://avatars1.githubusercontent.com/u/38261864?s=88&v=4' // `${user.avatar_url}&amp;r=x&amp;s=40`
  }
}

/**
 * If the user is in the `users` object, return the mapped URL, otherwise return the user's GitHub URL
 * @returns the user's html_url if the user is not in the users object. If the user is in the users
 * object, the function is returning the target property of the user.
 */
const getUserUrl = user => {
  const mappedUser = users[user.login]
  if (mappedUser) {
    return `/${mappedUser.target}`
  } else {
    return user.html_url
  }
}

/**
 * It takes a user object and returns the username of the user
 * @returns The username of the user.
 */
const getUsername = user => {
  const mappedUser = users[user.login]
  if (mappedUser) {
    return `${mappedUser.target}`
  } else {
    return user.login
  }
}

/**
 * It takes an issue object and returns a string that contains the issue's creation date, author, and
 * whether it was merged or closed
 * @param issue - The issue object from the GitHub API.
 * @returns A string
 */
const createMessage = (issue) => {
	const creation = formatDate(issue.created_at);

	const createdAvatar = issue.user.avatar_url ? `[<img alt="${issue.user.login}" height="40" width="40" align="left" src="${getAvatarUrl(issue.user)}">](${getUserUrl(issue.user)})` : ''

  const merged_at = issue.merged_at ? `Merged ${formatDate(issue.merged_at)}` : ''
  const closed_at = issue.closed_at ? `Closed ${formatDate(issue.closed_at)}` : ''
  const line3 = `_${merged_at || closed_at}_`.replace('__', '') // prevent possible `__` in comments

  return `
    > ${createdAvatar} **Authored by [${getUsername(issue.user)}](${getUserUrl(issue.user)})**
    _${creation}_
    ${line3}
    ---
  `.trim().split('\n').map(line => line.trim()).join('\n')
}

module.exports = createMessage
