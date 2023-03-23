const os = require('os')
const fs = require('fs-extra')

const config = require('./config')

/**
 * It reads the `packed-refs` file, replaces the pull request references with branch references, and
 * writes the file back
 */
const main = async () => {
  const headRegEx = /refs\/heads\/pr([0-9]+)head/
  const refsPath = `${config.source.repo}/.git/packed-refs`
  const refs = (await fs.readFile(refsPath, { encoding: 'utf-8' }))
    .split(os.EOL)
    .map(ref => ref.replace(/refs\/pull\/([0-9]+)\/head/, 'refs/heads/pr$1head'))
    .join(os.EOL)

  await fs.move(refsPath, `${refsPath}.back`)
  await fs.writeFile(refsPath, refs)
}

main()
  .catch(err => {
    console.error('Error:', err)
  })
