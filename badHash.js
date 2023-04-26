/* Importing the required modules. */
const { spawnSync } = require("child_process");
const fs = require('fs-extra');
const glob = require('glob');
const config = require('./config');

const badHashes = new Set();

/**
 * It runs `git show` on the given commit hash and checks if the output contains the string `fatal: bad
 * object`. If it does, it adds the hash to the `badHashes` set
 * @param sha - The commit hash to check
 * @param repoPath - The path to the repository you want to check.
 */
function isCommitHashBad(sha, repoPath) {
  const result = spawnSync("git", ["show", sha], { cwd: repoPath });
  if (result.stderr.toString("utf-8").includes("fatal: bad object")) {
    badHashes.add(sha);
  }
}

/**
 * It reads the files in the repo, gets the commit hashes from them, and then iterates over the commits
 * and checks if they are bad
 */
async function main() {
  const repoPath = `${config.source.repo}.git`;

  const issuesFiles = glob.sync(`${config.source.repo}/issues/issue-+([0-9]).json`);
  const issues = await Promise.all(issuesFiles.map(async (file) => JSON.parse(await fs.readFile(file))));

  const issuesBase = issues.filter((item) => item.head).map((item) => item.base.sha);
  const issuesHead = issues.filter((item) => item.base).map((item) => item.head.sha);

  const commitsData = JSON.parse(await fs.readFile(`${config.source.repo}/commits.json`));
  const commitsSHA = commitsData.map((item) => item.sha);
  const commitsParentsSHA = commitsData.flatMap((item) => item.parents).map((item) => item.sha);
  const commitsTrees = commitsData.map((item) => item.commit.tree.sha);

  const pullComments = JSON.parse(await fs.readFile(`${config.source.repo}/pull-comments.json`));
  const pullCommentsCommits = pullComments.map((item) => item.commit_id);

  const reviewComments = JSON.parse(await fs.readFile(`${config.source.repo}/review-comments.json`));
  const reviewCommentsCommits = reviewComments.map((item) => item.commit_id);

  const reviews = JSON.parse(await fs.readFile(`${config.source.repo}/reviews.json`));
  const reviewCommits = reviews.map((item) => item.commit_id);

  const commits = [
    ...reviewCommits,
    ...pullCommentsCommits,
    ...reviewCommentsCommits,
    ...issuesBase,
    ...issuesHead,
    ...commitsSHA,
    ...commitsParentsSHA,
    ...commitsTrees,
  ];

  const numCommits = commits.length;

  for (let i = 0; i < numCommits; i++) {
    const commit = commits[i];
    isCommitHashBad(commit, repoPath);

    if (i % 100 === 0) {
      const percentageRemaining = 100 - ((i + 1) / numCommits) * 100;
      process.stdout.write(`\r${percentageRemaining.toFixed(2)}% remaining hashes`);
    }
  }

  await fs.writeFile(`${config.source.repo}/bad_hashes.json`, JSON.stringify([...badHashes], null, 2));

  process.stdout.write(`\r done`);
  process.stdout.write(`\n`);
}

main();
