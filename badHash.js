const { spawnSync } = require("child_process");
const fs = require('fs-extra')
const glob = require('glob')
const config = require('./config')

const badHashes = [];

function isCommitHashBad(sha, repoPath) {
  const result = spawnSync("git", ["show", sha], { cwd: repoPath });

  if (result.stderr.toString("utf-8").includes("fatal: bad object")) {
    badHashes.push(sha);
    //console.log("bad hash:", sha);
  }
}

function main() {
  const repoPath = `${config.source.repo}/.git`;

  const issuesFiles = glob.sync(`${config.source.repo}/issues/issue-+([0-9]).json`);
  const issues = issuesFiles.map(file => JSON.parse(fs.readFileSync(file)));

  const issuesBase = issues.filter(item => item.head).map(item => item.base.sha);
  const issuesHead = issues.filter(item => item.base).map(item => item.head.sha);

  const commitsData = JSON.parse(fs.readFileSync(`${config.source.repo}/commits.json`));
  const commitsSHA = commitsData.map(item => item.sha);
  const commitsParentsSHA = commitsData.map(item => item.parents).flat().map(item => item.sha);
  const commitsTrees = commitsData.map(item => item.commit.tree.sha);

  const pullComments = JSON.parse(fs.readFileSync(`${config.source.repo}/pull-comments.json`));
  const pullCommentsCommits = pullComments.map(item => item.commit_id);

  const reviewComments = JSON.parse(fs.readFileSync(`${config.source.repo}/review-comments.json`));
  const reviewCommentsCommits = reviewComments.map(item => item.commit_id);

  const reviews = JSON.parse(fs.readFileSync(`${config.source.repo}/reviews.json`));
  const reviewCommits = reviews.map(item => item.commit_id);

  const commits = []
    .concat(reviewCommits, pullCommentsCommits, reviewCommentsCommits, issuesBase, issuesHead, commitsSHA, commitsParentsSHA, commitsTrees)

    const numCommits = commits.length;

  for (let i = 0; i < numCommits; i++) {
    const commit = commits[i];
    isCommitHashBad(commit, repoPath);

    // Calculate the percentage remaining and log it every second
    if (i % 100 == 0) {
      const percentageRemaining = 100 - ((i + 1) / numCommits) * 100;
      process.stdout.write(`\r${percentageRemaining.toFixed(2)}% remaining hashes`);
    }
  }


  const badHashesSet = [...new Set(badHashes)];

  fs.writeFileSync(`${config.source.repo}/bad_hashes.json`, JSON.stringify(badHashesSet, null, 2));

  process.stdout.write(`\r done`);
  process.stdout.write(`\n`);
}

main();
