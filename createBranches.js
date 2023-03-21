const request = require('request-promise')
const fs = require('fs-extra')
const glob = require('glob')

const { sleep } = require('./utils')
const config = require('./config')
//const { head } = require('request')
const api = `${config.target.baseUrl}/${config.target.org}/${config.target.repo}`

const headers = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'node.js'
}
if (config.target.token) {
  headers['Authorization'] = `token ${config.target.token}`
}

const createBranch = async (issue) => {
  const ref = `refs/heads/pr${issue.number}base`
  console.log(issue.base.sha);
  await request({
    method: 'POST',
    headers,
    url: `${api}/git/refs`,
    body: {
      ref,
      sha: issue.base.sha,
    },
    json: true,
  }).catch(err => {
    console.log(`Unable to create ref: ${ref}`)
    console.log(err.message)
  })
}

// const createHead = async (issue) => {
//   const ref = `refs/heads/pr${issue.number}head`
//   await request({
//     method: 'POST',
//     headers,
//     url: `${api}/git/refs`,
//     body: {
//       ref,
//       sha: issue.head.sha,
//     },
//     json: true,
//   }).catch(err => {
//     console.log(`Unable to create ref: ${ref}`)
//     console.log(err.message)
//   })
// }

const isBranchMade = async (issue) => {
  const url = `${api}/branches/pr${issue.number}base`
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

const main = async () => {
  const issues = glob.sync(`${config.source.repo}/issues/issue-+([0-9]).json`)
    .map(file => JSON.parse(fs.readFileSync(file)))
    .sort((a, b) => a.number - b.number)
  //let heads = glob.sync(`${config.source.repo}/.git/refs/heads/*`)
  // for(let i = 0; i < (heads.length+1); i++)
  // {
  //   let temp = (heads[i]).toString
  //   console.log(`${temp}`)
  //   heads[i] = temp.substring(temp.lastIndexOf("/"),temp.length)
  // }

  // console.log(issues)
  for (let issue of issues) {
    if (issue.base) {
      console.log(`Creating branch for PR-${issue.number}`)
      await createBranch(issue)
     // await sleep(60 * 60 * 1000 / config.apiCallsPerHour)
     let branchExists = await isBranchMade(issue)
      while (!branchExists) {
        console.log(`Waiting for branch pr${issue.number}base to exist`)
        await sleep(1000)
        branchExists = await isBranchMade(issue)
      }
      await sleep(1000)
    }

    // if(issue.head)
    // {
    //   await createHead(issue)
    //   let branchExists = await isBranchMade(issue.head.ref)
    //   while (!branchExists) {
    //     console.log(`Waiting for branch ${issue.head.ref} to exist`)
    //     await sleep(1000)
    //     branchExists = await isBranchMade(issue.head.ref)
    //   }
    // }

     //await sleep(60 * 60 * 1000 / config.apiCallsPerHour)
      // for(let i = 0; i < (heads.length+1); i++)
      // {
      //   console.log(`${heads.at(i)} \n ${config.source.repo}/.git/refs/heads/`+ `${issue.head.ref}`)
      //   if(heads.at(i) == `${config.source.repo}/.git/refs/heads/`+ `${issue.head.ref}`)
      //   {
      //     console.log(`head ref exists in source repo`)
      //     console.log(`${heads.at(i)} \n ${config.source.repo}/.git/refs/heads/`+ `${issue.head.ref}`)
      //     break
      //   }
      //   else if(heads.length == i)
      //   {
      //     console.log(`Creating branch for PR-${issue.number}`)
      //     await createHead(issue)
      //     await sleep(60 * 60 * 1000 / config.apiCallsPerHour)
      //   }
      // }
    //}
  }
}

main()
