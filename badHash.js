// Import required modules
const { spawnSync } = require("child_process");
const fs = require('fs-extra');
const glob = require('glob');
const config = require('./config');

// Create a Set to store bad commit hashes
const badHashes = new Set();

// Function to check if a commit hash is bad
function isCommitHashBad(sha, repoPath) {
  // Run "git show" command to check if the commit exists in the repo
  const result = spawnSync("git", ["show", sha], { cwd: repoPath });
  // If the stderr output includes "fatal: bad object", then the commit is not valid
  if (result.stderr.toString("utf-8").includes("fatal: bad object")) {
    // Add the bad commit hash to the Set
    badHashes.add(sha);
  }
}

// Main function
async function main() {
  // Set the path to the repo's .git folder
  const repoPath = `${config.source.repo}/.git`;

  // Find all issue files in the repo's "issues" directory and parse their contents
  const issuesFiles = glob.sync(`${config.source.repo}/issues/issue-+([0-9]).json`);
  const issues = await Promise.all(issuesFiles.map(async (file) => JSON.parse(await fs.readFile(file))));

  // Get the base and head commit hashes for each issue
  const issuesBase = issues.filter((item) => item.head).map((item) => item.base.sha);
  const issuesHead = issues.filter((item) => item.base).map((item) => item.head.sha);

  // Parse the "commits.json" file to get all commit hashes, parent commit hashes, and tree hashes
  const commitsData = JSON.parse(await fs.readFile(`${config.source.repo}/commits.json`));
  const commitsSHA = commitsData.map((item) => item.sha);
  const commitsParentsSHA = commitsData.flatMap((item) => item.parents).map((item) => item.sha);
  const commitsTrees = commitsData.map((item) => item.commit.tree.sha);

  // Parse the "pull-comments.json" file to get all commit hashes that have pull request comments
  const pullComments = JSON.parse(await fs.readFile(`${config.source.repo}/pull-comments.json`));
  const pullCommentsCommits = pullComments.map((item) => item.commit_id);

  // Parse the "review-comments.json" file to get all commit hashes that have review comments
  const reviewComments = JSON.parse(await fs.readFile(`${config.source.repo}/review-comments.json`));
  const reviewCommentsCommits = reviewComments.map((item) => item.commit_id);

  // Parse the "reviews.json" file to get all commit hashes that have been reviewed
  const reviews = JSON.parse(await fs.readFile(`${config.source.repo}/reviews.json`));
  const reviewCommits = reviews.map((item) => item.commit_id);

  // Combine all the above commit hashes into a single array
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

  // Get the total number of commits to check
  const numCommits = commits.length;

  // Loop through each commit hash and check if it's bad
  for (let i = 0; i < numCommits; i++) {
    const commit = commits[i];
    isCommitHashBad(commit, repoPath);

    // Calculate the percentage remaining and log it every second
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
