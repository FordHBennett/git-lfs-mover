## Github Migration Guide

This repo was built to migrate large repositories (i.e `git clone <source-repo-ssh> --mirror` > 2GB) and git lfs objects. It is highly recommended to use Michael Welch's git migration (https://github.com/NicholasBoll/github-migration) if when you clone your repository using `git clone <source-repo-ssh> --mirror`<  2GB. Credit goes to Michael Welch for creating the base code. The `migration.sh` file has been added to further streamline the amount of commands needed to run in the terminal, whereas features have been added to enhance the base code—such as the support for git lfs objects as well as repos that are too big for `git push <dest-repo> --mirror` —the creation of issues, branches, and comments has been optimized.

It is important for users to ensure that they have non-user admin tokens for both their source and target GitHub before beginning the migration process. Furthermore, this tool does not create a new repository in the destination GitHub; users will have to create an empty repository in their target Github to migrate their source repository into. If you have dependabot security updates enabled, disable it before pushing your new repo. If it picks up a new vulnerability, it can auto-create a PR and your issue numbers will no longer match. There is no API access to migrate images to the target GitHub CDN Githubusercontent. The tool checks whether images are in issues' descriptions or comments, uploads them to the provided S3 bucket, and updates the image link. If you want to use this functionality, create an S3 bucket and configure it in the `config.js` and `s3Config.js` files that are created during initialization. (See below steps)


#### Preparation Steps
1. Ensure you have non-user admin tokens for both the source and the target Github.
2. Create an empty repository in the destination Github.
3. If you have dependabot security updates enabled, disable it before pushing your new repo. If it picks up a new vulnerability, it can auto-create a PR and your issue numbers will no longer match.
4. There is no API access to migrate images to the target GitHub CDN
   Githubusercontent. The tool checks whether images are in issues' descriptions
   or comments, uploads them to the provided S3 bucket, and updates the image
   link. If you want to use this functionality, create an S3 bucket and
   configure it in the `config.js` and `s3Config.js` files that are created
   during initialization. (See below steps)
5. Edit bash_config.sh variables.
6. Edit line 11 of `createComments.js` so that `const dummyCommit =` any valid commit hash:
     1. `git clone  <source-repo-ssh> --single-branch`.
     2. `cd <source-repo>`.
     3. Copy the result of `git rev-list --max-parents=0 HEAD`.
     4. `cd ..`.
     5. `rm -rf <source-repo>`.
     6. Edit line 11 of `createComments.js` so that `const dummyCommit =` the
        result of `git rev-list --max-parents=0 HEAD`.


#### Migration Steps
1. Clone this repository.
2. Navigate to the `git-lfs-mover` directory.
3. run `npm run install`.
4. Run the initialization script by running `node init.js`.
5. Edit `config.js` and `s3Config.js`.
   Optional:
      Test your source configuration by running `node test.js source`.
      Test your destination configuration by running `node test.js target`
      Test your S3 configuration by running `node s3Test.js`
6. Edit `migrate.sh` and `createComments.js` as described above.
7. Make the `migrate.sh` executable by running `chmod -x migrate.sh`.
8. Run `./migrate.sh -h` to view the flags.
9. Run `./migrate.sh` with the specified flags.
