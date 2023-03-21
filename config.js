
module.exports = {
  source: {
    /**
     * URL for the API endpoint of your source github. Do not include a trailing /
     */
    baseUrl: 'https://github.tamu.edu/api/v3/repos',
    /**
     * Org or Username of your source github
     */
    org: 'SpaceCRAFT',
    /**
     * Repo field of your source github
     */
    repo: 'Platform',
    /**
     * Optional token to access your source github. If you have GHE, you may not need to fill this in
     */
    token: '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',
    /**
     * URL for the API endpoint of your source github. Do not include a trailing /
     */
    ssh: "git@github.tamu.edu:SpaceCRAFT/Platform.git",
  },
  target: {
    baseUrl: 'https://api.github.com/repos',
    /**
     * Org or Username of your target github
     */
    org: 'SimDynamX',
    /**
     * Repo field of your target github
     */
    repo: 'SC_Platform',
    /**
     * Optional token to access your target github. If you have GHE, you may not need to fill this in
     */
    token: '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',
    /**
     * Optional comment token. Comments only need read-only. If this is defined, this token will be used for comments, otherwise it will fall back to the general token
     */
    commentToken: '',
    /**
     * Optional URL for user avatars when creating issues and comments. Requires 'id' config in 'users.json'
     * @example
     */
    avatarUrl: '',

    ssh: "git@github.com:SimDynamX/SC_Platform.git",
  },
  /**
   * This value will throttle scripts to prevent going over API limits
   */
  apiCallsPerHour: 3000,
  /**
   * Optional
   * BFG command to run: https://rtyley.github.io/bfg-repo-cleaner/
   * This value will include just arguments.
   * For example: '--strip-blobs-bigger-than 5M'
   */
  bfg: '',
  /**
   * Optional
   * If you are moving from Github Enterprise to github.com, you're images won't be viewable when migrated.
   * If you have an s3 account, this will upload images to an s3 bucket (you have to make the bucket public)
   **/
  s3Bucket: 'sc-git-issue-assets-backup'
}
