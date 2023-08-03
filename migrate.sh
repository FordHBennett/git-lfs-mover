#!/bin/bash
shopt -s nullglob dotglob

# Import configuration values from bash_config.sh
source bash_config.sh

# Import throw_error function from throw_error.sh
source throw_error.sh

# Import kill_migrate_process function from kill_migrate_process.sh
source modify-migrate-process/kill_migrate_process.sh
source modify-migrate-process/pause_migrate_process.sh
source modify-migrate-process/resume_migrate_process.sh

# Source repo ssh
readonly SRC_SSH
# Target repo ssh
readonly TARGET_SSH
# Source repo directory path
readonly REPO_DIR
# Source repo mirror path
readonly REPO_MIRROR

display_usage() {
    echo "Usage: $0 [-b BATCH_SIZE] [-c] [-n BRANCH_NUM] [-v] [-h]"
    echo "Options:"
    echo "  -b BATCH_SIZE    Number of branches pushed in parallel (default: 1)"
    echo "  -c               Clone the source repository. Use this option if you are running this script for the first time."
    echo "  -n BRANCH_NUM    Number of branches that have already been pushed(default: 0)"
    echo "  -v               Enable verbose mode"
    echo "  -h               Display this help message and exit"
    echo
    echo "Note:"
    echo "  -b               Specifies the number of branches that will be pushed in parallel."
    echo "                   If not specified, the script will push 1 branch at a time."
    echo "  -c               Use this option if you are running this script for the first time."
    echo "                   This option will clone the source repository and perform the migration."
    echo "                   If not specified, the script will assume that the source repository is already cloned."
    echo "  -n               Specifies the number of branches to skip."
    echo "                   If not specified, the script will start from the first branch."
    echo "  -v               Enable verbose mode."
    echo "                   If not specified, the script will run in silent mode."
    echo "  -h               Display this help message and exit."
    echo
    echo "Examples:"
    echo "  $0 -b 5 -n 10 -c"
    echo "  $0 -c"
    echo "  $0 -v"
    echo "  $0 -h"
}

# Function to parse command-line arguments
parse_args() {
    while getopts 'b:cn:vh' flag; do
        case "${flag}" in
            b) BATCH_SIZE="${OPTARG}" ;;
            c) CLONE_FLAG="true" ;;
            n) BRANCH_NUM="${OPTARG}" ;;
            v) VERBOSE="true" ;;
            h) display_usage; exit 0 ;;  # Display help message and exit
            \?) display_usage; exit 1 ;;
            :) echo "Option -${OPTARG} requires an argument."; display_usage; exit 1 ;;
        esac
    done
}


# Function to handle SIGINT (Ctrl+C) signal
handle_interrupt() {
    echo "Received SIGINT (Ctrl+C). Press 'r' to resume or 'q' to quit."
    echo "$(sh modify-migrate-process/pause_migrate_process.sh)"
    while true; do
        read -r -n 1 -s response
        case $response in
            [Rr]) # Resume the script
                echo "Resuming..."
                echo "$(sh modify-migrate-process/resume_migrate_process)"
                break ;;
            [Qq]) # Quit the script
                echo "Exiting..."
                echo "$(sh modify-migrate-process/kill_migrate_process.sh)"
                exit 0 ;;
        esac
    done
}

# Function to handle SIGTSTP (Ctrl+Z) signal
handle_stop() {
    echo "Received SIGTSTP (Ctrl+Z). Press 'r' to resume or 'q' to quit."
    echo "$(sh modify-migrate-process/pause_migrate_process.sh)"
    while true; do
        read -r -n 1 -s response
        case $response in
            [Rr]) # Resume the script
                echo "Resuming..."
                echo "$(sh modify-migrate-process/resume_migrate_process)"
                break ;;
            [Qq]) # Quit the script
                echo "Exiting..."
                echo "$(sh modify-migrate-process/kill_migrate_process.sh)"
                exit 0 ;;
        esac
    done
}

# Register signal handlers
trap handle_interrupt SIGINT
trap handle_stop SIGTSTP

clone_mirror_repo() {
    if clone_mirror=$(git clone --mirror "$SRC_SSH" >/dev/null 2>&1); then
      printf '%s
    ' "$clone_mirror"
      echo "Successfully cloned $SRC_SSH to $REPO_MIRROR"
    else
      echo "Failed to clone $SRC_SSH; exited with $?" >&2
      echo "If the exit code is 128, then the repository is already cloned." >&2
      exit 1
    fi

    mkdir "$REPO_DIR"
    mv "$REPO_MIRROR" "$REPO_DIR"
    cd "$REPO_DIR"
    mv "$REPO_MIRROR" ".git"

    git init
    git config --bool core.bare false
    git checkout

    if fetch_all=$(git fetch --all --tags --update-head-ok 2>&1); then
      printf '%s
      ' "$fetch_all"
    else
      echo "git fetch failed; exited with $?" >&2
      exit 1
    fi

    if fetch_lfs_all=$(git lfs fetch --all 2>&1); then
      printf '%s
    ' "$fetch_lfs_all"
    else
      echo "git lfs fetch failed; exited with $?" >&2
      exit 1
    fi

    cd ..

    if fetch=$(node fetch.js 2>&1); then
      printf '%s
    ' "$fetch"
    else
      echo "node fetch.js failed; exited with $?" >&2
      exit 1
    fi

    if rewriteRefs=$(node rewriteRefs.js 2>&1); then
      printf '%s
    ' "$rewriteRefs"
    else
      echo "node rewriteRefs.js failed; exited with $?" >&2
      exit 1
    fi
}
# Pushing small commits to the given branch.
push_small_commits_to_branch()
{
    local branch="$1"

    local commit_array=()
    while read -r line; do
      commit_array+=("$line")
    done < <(git rev-list --reverse $branch)

    for ((i=0; i<${#commit_array[@]}; i+=25)); do
        echo  $(git push --force "$TARGET_SSH" "${commit_array[i]}:$branch")
    done

    # Push tags related to the given branch
    echo $(git push --force "$TARGET_SSH" "$branch" )
    echo $(git push --force "$TARGET_SSH" "$branch" --tags)
    echo $(git lfs push --force "$TARGET_SSH" "$branch" )
}
push_small_commits_in_parallel() {
    local branches=("$@")

    export -f push_small_commits_to_branch # Export the function to make it available for parallelization

    for ((i=0; i<"${#branches[@]}"; i+=1)); do
        push_small_commits_to_branch "${branches[i]}" &
        echo "Pushing branch ${branches[i]}..."
    done
    wait
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

    # Call parse_args using eval to execute it in the current shell context
    eval "parse_args $*"

    if [ "$VERBOSE" == "true" ]; then
        set -x
    fi

    # Call throw_errors using eval to execute it in the current shell context
    throw_errors

    echo "Starting migration..."

    echo  "BATCH_SIZE: $BATCH_SIZE"

    if [ "$CLONE_FLAG" == "true" ]; then
        clone_mirror_repo
    fi

    if [ ! -d "$REPO_DIR" ]; then
        echo "Error: $REPO_DIR does not exist. Please run this script with the -c option to clone the source repository."
        exit 1
    fi

    cd "$REPO_DIR"

    refs=$(cat .git/packed-refs | awk '$2 ~ /^refs\/heads/{print $2}')
    refs_array=($refs)

    for ((; $BRANCH_NUM<"${#refs_array[@]}"; BRANCH_NUM+=$BATCH_SIZE));do
        echo "$BRANCH_NUM" > ../branch_num.txt
        local refs_parrallel_arr=()
        for ((i=0; i<${BATCH_SIZE}; i++)); do
          refs_parrallel_arr+=("${refs_array[BRANCH_NUM+i]}")
        done
        push_small_commits_in_parallel "${refs_parrallel_arr[@]}"
        if push_all=$(git push "$TARGET_SSH" --all 2>&1); then
          printf '%s
        ' "$push_all"
          break
        fi
    done

    # Push the remaining branches
    refs_parrallel_remaining_arr=()
    for ((i=0; i<((${#refs_array[@]} % ${batch_size} )); i++)); do
      refs_parrallel_remaining_arr+=("${refs_array[BRANCH_NUM+i]}")
    done
    push_small_commits_in_parallel "${refs_parrallel_remaining_arr[@]}"

    # Push all changes to the remote repository
    echo $(git push "$TARGET_SSH" --all)
    echo $(git lfs push "$TARGET_SSH" --all)
    cd ..

    if createBranches=$(node createBranches.js 2>&1); then
      printf '%s
    ' "$createBranches"
    else
      echo "node createBranches.js failed; exited with $?" >&2
      exit 1
    fi

    if createIssues=$(node createIssues.js 2>&1); then
      printf '%s
    ' "$createIssues"
    else
      echo "node createIssues.js failed; exited with $?" >&2
      exit 1
    fi

    if createComment=$(node createComments.js 2>&1); then
      printf '%s
    ' "$createComment"
    else
      echo "node createComments.js failed; exited with $?" >&2
      exit 1
    fi

    if updateIssue=$(node updateIssues.js 2>&1); then
      printf '%s
    ' "$updateIssue"
    else
      echo "node updateIssues.js failed; exited with $?" >&2
      exit 1
    fi

    if deleteBranches=$(node deleteBranches.js 2>&1); then
      printf '%s
    ' "$deleteBranches"
    else
      echo "node deleteBranches.js failed; exited with $?" >&2
      exit 1
    fi

    if createReleases=$(node createReleases.js 2>&1); then
      printf '%s
    ' "$createReleases"
    else
      echo "node createReleases.js failed; exited with $?" >&2
      exit 1
    fi

    echo "Migration completed successfully!"
    display_txt_file "mettons.txt"
}

main "$@"