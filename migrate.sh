#!/bin/bash
shopt -s nullglob dotglob

readonly SRC_SSH="git@github.tamu.edu:SpaceCRAFT/Platform.git"
readonly TARGET_SSH="https://github.com/SimDynamX/SC_Platform.git"
readonly REPO_DIR_NAME="Platform"
readonly REPO_PATH="Platform.git/"

push_small_commits()
{
    local branch="$1"
    printf "Pushing small commits to: %s\n" "$branch"

    small_push=$(git rev-list --reverse "$branch" | xargs -I{} git push --force "$TARGET_SSH" +{}:refs/heads/"$branch")
    echo "$small_push"

    final_small_push=$(git push --tags "$TARGET_SSH" "$branch" )
    echo "$final_small_push"

    # git config --bool core.bare false
    lfs_push=$(git lfs push --all "$TARGET_SSH" "$branch" )
    echo "$lfs_push"
}
push_small_commits_in_parallel() {
    local arr=("$@")
    export -f push_small_commits

    for branch in "${arr[@]}"; do
        push_small_commits "$branch"
    done

}
main()
{
    # clone_src_repo = $(git clone --mirror "$SRC_SSH")
    # echo $clone_src_repo
    # mkdir "$REPO_DIR_NAME"
    # mv "$REPO_PATH $REPO_DIR_NAME/.git"
    # echo "moving $REPO_PATH to $REPO_DIR_NAME/.git"
    cd "$REPO_DIR_NAME"
    # git init
    # git config --bool core.bare false
    # echo "git config --bool core.bare false"
    # fetch_all =$(git fetch --all --recurse-submodules --tags --update-head-ok)
    # echo "$fetch_all"
    # fetch_lfs_all=$(git lfs fetch --all)
    # echo "$fetch_lfs_all"
    # pull=$(git pull --all)
    # echo "$pull"
    # lfs_pull=$(git lfs pull)
    # echo "$lfs_pull"
    # current_dir=$("pwd")
    # echo "$current_dir"

    # Filter out unwanted branches and add "master" to the beginning of the list
    #filtered_branches=$(git branch -a | tr -d " " | grep -vE "^pr.*head$" | sed "s/remotes\/origin\///" | grep -v "^\s*$" | sort | uniq | sed "s/^master$/&\n/" | sed "1s/^/master\n/")
    IFS=$'\n' filtered_branches=($(git branch -a | tr -d " " | grep -vE "^pr.*head$" | sed "s/remotes\/origin\///" | grep -v "^\s*$" | sort | uniq | sed "s/^master$/&\n/" | sed "1s/^/master\n/"))

    # Push small commits to branches in parallel
    export -f push_small_commits_in_parallel

    # Checkout master
    # git checkout master

    # Iterate over the branches and push small commits
    for i in "${!filtered_branches[@]}"; do
        if (($i % 5 == 0 || $i == 0)); then
            arr=()
            arr+=("${filtered_branches[i]}")
            arr+=("${filtered_branches[i+1]}")
            arr+=("${filtered_branches[i+2]}")
            arr+=("${filtered_branches[i+3]}")
            arr+=("${filtered_branches[i+4]}")
            push_small_commits_in_parallel "${arr[@]}"&
        fi
    done
    wait
    # for branch in $filtered_branches; do
    #     echo "$branch"
    #     push_small_commits "$branch"
    # done

    git push "$TARGET_SSH" --all
    git push "$TARGET_SSH" --mirror
    git lfs push "$TARGET_SSH" --all
}

main