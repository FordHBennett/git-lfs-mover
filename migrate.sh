#!/bin/bash
shopt -s nullglob dotglob

# Source repo ssh
readonly SRC_SSH="git@github.com:username/source_repo.git"
# Target repo ssh
readonly TARGET_SSH="git@github.com:username/target_repo.git"
# Source repo directory path
readonly REPO_DIR_NAME="/path/to/local/source/directory"
# Source repo mirror path
readonly REPO_PATH="/path/to/local/source/directory.git"

# Pushing small commits to the given branch.
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
display_txt_file() {
  if [ -f "$1" ] && [ "${1: -4}" == ".txt" ]; then
    cat "$1"
  else
    echo "Error: Please provide a valid .txt file as an argument."
  fi
}
main()
{

    #TODO: Create a npm script to install all dependencies
    clone_src_repo = $(git clone --mirror "$SRC_SSH")
    echo $clone_src_repo

    mkdir "$REPO_DIR_NAME"
    mv "$REPO_PATH $REPO_DIR_NAME/.git"
    echo "moving $REPO_PATH to $REPO_DIR_NAME/.git"
    cd "$REPO_DIR_NAME"
    git init
    git config --bool core.bare false # Set the bare option to false to enable working with the repository
    echo "git config --bool core.bare false"

    fetch_all =$(git fetch --all --recurse-submodules --tags --update-head-ok)
    echo "$fetch_all"

    fetch_lfs_all=$(git lfs fetch --all)
    echo "$fetch_lfs_all"

    pull=$(git pull --all)
    echo "$pull"

    lfs_pull=$(git lfs pull)
    echo "$lfs_pull"
    current_dir=$("pwd")
    echo "$current_dir"

    node fetch.js
    node rewrite.js

    IFS=$'\n' filtered_branches=($(git branch -a | tr -d " " | grep -vE "^pr.*head$" | sed "s/remotes\/origin\///" | grep -v "^\s*$" | sort | uniq | sed "s/^master$/&\n/" | sed "1s/^/master\n/"))

    export -f push_small_commits_in_parallel

    git checkout master

    num_branches=0
    for ((num_branches=0; num_branches<${#filtered_branches[@]}; num_branches++)); do
    if ((num_branches % 3 == 0 || num_branches == 0)); then
        arr=()\n    arr+=("${filtered_branches[num_branches]}")
        arr+=("${filtered_branches[num_branches+1]}")
        arr+=("${filtered_branches[num_branches+2]}")
        push_small_commits_in_parallel "${arr[@]}" &
    fi
    done
    wait

    if ((num_branches % 3 == 1)); then
    push_small_commits "${filtered_branches[num_branches-1]}"
    elif ((num_branches % 3 == 2)); then
    push_small_commits "${filtered_branches[num_branches-2]}"
    push_small_commits "${filtered_branches[num_branches-1]}"
    fi


    # Push all changes to the remote repository
    git push "$TARGET_SSH" --all
    git lfs push "$TARGET_SSH" --all
    git push "$TARGET_SSH" --mirror

    cd ..

    createBranches=$(node createBranches.js)
    echo "$createBranches"

    createIssues=$(node createIssues.js)
    echo "$createIssues"

    createComment=$(node createComments.js)
    echo "$createComment"

    updateIssue=$(node updateIssues.js)
    echo "$updateIssue"

    deleteBranches=$(node deleteBranches.js)
    echo "$deleteBranches"

    createReleases=$(node createReleases.js)
    echo "$createReleases"

    echo "Migration completed successfully!"
    display_txt_file "mettons.txt"

}

main