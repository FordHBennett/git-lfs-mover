## Github migration guide

This repo was built to migrate large repos (i.e `git clone <source-repo-ssh> --mirror` > 2GB) and git lfs objects. It is highly recommended to use Michael Welch's git migration (https://github.com/NicholasBoll/github-migration) if you clone your repo using `git clone <source-repo-ssh> --mirror`.

Credit to [Michael Welch](https://github.com/NicholasBoll/github-migration) for creating the base code. This code has been cleaned up, added support for git lfs objects as well as repos that are too big for `git push <dest-repo> --mirror`, optimized the creation of issues, branches, and comments, and further streamlined the amount of commands needed to run in the terminal with the creation of `migration.sh`.

It is best to do this process on a VM because depending on your repo size, it may take days to complete.

**Preparation Steps:**

1. Ensure that you have non-user admin tokens for both your source and target Github.
2. This tool does not create a new repository in the target GitHub. You will have to create an empty repository in your target Github to migrate your source repository into.
   - If you have `dependabot security updates` enabled, disable it before pushing your new repo. If it picks up a new vulnerability, it can auto-create a PR and your issue numbers will no longer match.
3. There is no API access to migrate images to the target GitHub CDN Githubusercontent. This tool checks whether images are in issues' descriptions or comments, uploads them to the provided S3 bucket, and updates the image link.
   - **Optional** If you want to use this functionality, create an S3 bucket and configure it in the `config.js` and `s3Config.js` files that are created during initialization. (See below steps)
4. Edit line 11 of `createComments.js` so that `const dummyCommit =` any valid commit hash.
   - You can do this by:
     1. `git clone  <source-repo-ssh> --single-branch`
     2. `cd <source-repo>`
     3. Copy the result of `git rev-list --max-parents=0 HEAD`
     4. `cd ..`
     5. `rm -rf <source-repo>`
     6. Edit line 11 of `createComments.js` so that `const dummyCommit =` the result of `git rev-list --max-parents=0 HEAD`

**Migration Steps:**

1. Clone this repository.
2. `cd git-lfs-mover`.
3. Make the `migrate.sh` file executable by running `chmod -x migrate.sh`.
4. Run the `migrate.sh` file by running `./migrate.sh` in the terminal.