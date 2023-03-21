#!/bin/bash
shopt -s nullglob dotglob

# Source repo ssh
readonly SRC_SSH="git@github.tamu.edu:SpaceCRAFT/Platform.git"
# Target repo ssh
readonly TARGET_SSH="https://github.com/SimDynamX/SC_Platform.git"
# Source repo local directory name
readonly REPO_DIR_NAME="Platform"
# Source repo mirror path
readonly REPO_PATH="Platform.git/"

push_small_commits()
{
    local branch="$1"
    printf "Pushing small commits to: %s\n" "$branch"

    # Reverse the order of commits and push them one by one
    small_push=$(git rev-list --reverse "$branch" | xargs -I{} git push --force "$TARGET_SSH" +{}:refs/heads/"$branch")
    echo "$small_push"

    # Push tags related to the given branch
    final_small_push=$(git push --tags "$TARGET_SSH" "$branch" )
    echo "$final_small_push"

    # Push all git-lfs files to the given branch
    lfs_push=$(git lfs push --all "$TARGET_SSH" "$branch" )
    echo "$lfs_push"
}
push_small_commits_in_parallel() {
    local arr=("$@")
    export -f push_small_commits # Export the function to make it available for parallelization

    for branch in "${arr[@]}"; do
        push_small_commits "$branch"
    done

}
main()
{
    # Clone the source repository using git mirror
    clone_src_repo = $(git clone --mirror "$SRC_SSH")
    echo $clone_src_repo

    # Move the cloned repository to a new directory and initialize it
    mkdir "$REPO_DIR_NAME"
    mv "$REPO_PATH $REPO_DIR_NAME/.git"
    echo "moving $REPO_PATH to $REPO_DIR_NAME/.git"
    cd "$REPO_DIR_NAME"
    git init
    git config --bool core.bare false # Set the bare option to false to enable working with the repository
    echo "git config --bool core.bare false"

    # Fetch all data from the remote repository including submodules and tags
    fetch_all =$(git fetch --all --recurse-submodules --tags --update-head-ok)
    echo "$fetch_all"

    # Fetch all git-lfs files from the remote repository
    fetch_lfs_all=$(git lfs fetch --all)
    echo "$fetch_lfs_all"

    # Pull all changes from the remote repository to the local repository
    pull=$(git pull --all)
    echo "$pull"

    # Pull all git-lfs files from the remote repository to the local repository
    lfs_pull=$(git lfs pull)
    echo "$lfs_pull"
    current_dir=$("pwd")
    echo "$current_dir"

    # Filter out unwanted branches and add "master" to the beginning of the list
    IFS=$'\n' filtered_branches=($(git branch -a | tr -d " " | grep -vE "^pr.*head$" | sed "s/remotes\/origin\///" | grep -v "^\s*$" | sort | uniq | sed "s/^master$/&\n/" | sed "1s/^/master\n/"))

    # Push small commits to branches in parallel
    export -f push_small_commits_in_parallel

    # Checkout master
    git checkout master

    # Iterate over the filtered branches and push small commits in parallel
    for i in "${!filtered_branches[@]}"; do
        # If the index is divisible by 5 or is 0
        if (($i % 5 == 0 || $i == 0)); then
            # Create an array with the current and next four branches
            arr=()
            arr+=("${filtered_branches[i]}")
            arr+=("${filtered_branches[i+1]}")
            arr+=("${filtered_branches[i+2]}")
            arr+=("${filtered_branches[i+3]}")
            arr+=("${filtered_branches[i+4]}")
            # Call the push_small_commits_in_parallel function with the array of branches
            push_small_commits_in_parallel "${arr[@]}"&
        fi
    done
    # Wait for all parallel processes to finish
    wait

    # Push all changes to the remote repository
    git push "$TARGET_SSH" --all
    git push "$TARGET_SSH" --mirror
    git lfs push "$TARGET_SSH" --all
}

main