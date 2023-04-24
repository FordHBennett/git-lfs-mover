#!/bin/bash
shopt -s nullglob dotglob

# Import configuration values from bash_config.sh
source bash_config.sh

# Source repo ssh
readonly SRC_SSH
# Target repo ssh
readonly TARGET_SSH
# Source repo directory path
readonly REPO_DIR
# Source repo mirror path
readonly REPO_MIRROR



# Pushing small commits to the given branch.
push_small_commits_to_branch()
{
    local branch="$1"
    printf "Pushing small commits to: %s\n" "$branch"

    # Checkout the given branch
    echo $(git switch -C "$branch")
    echo "$(git lfs fetch)"
    echo "$(git lfs checkout)"

    # Reverse the order of commits and push them one by one
    count=0
    for commit in $(git rev-list --reverse $branch | ruby -ne 'i ||= 0; i += 1; puts $_ if i % 100 == 0'); do
        echo $(git push --force "$TARGET_SSH" "$commit:refs/heads/$branch")
        count=$((${count} + 1))
    done

    # Push tags related to the given branch
    echo $(git push --force "$TARGET_SSH" --tags "$branch" )

    # Push all git-lfs files to the given branch
    echo $(git lfs push "$TARGET_SSH" "$branch" )
}
push_small_commits_in_parallel() {
    local arr=("$@")
    export -f push_small_commits_to_branch # Export the function to make it available for parallelization

    for branch in "${arr[@]}"; do
        push_small_commits_to_branch "$branch" &
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
    # Run the node test.js script
    echo "$(src_test)"
    echo "$(target_test)"


    if clone_mirror=$(git clone --mirror "$SRC_SSH" "$REPO_MIRROR" >/dev/null 2>&1); then
      printf '%s
    ' "$clone_mirror"
      echo "Successfully cloned $SRC_SSH to $REPO_MIRROR"
    else
      echo "Failed to clone $SRC_SSH; exited with $?" >&2
      exit 1
    fi



    # Create a new directory to store the cloned repository and move the mirrored repository inside
    mkdir "$REPO_DIR"
    mv "$REPO_MIRROR" "$REPO_DIR"
    cd "$REPO_DIR"

    mv "$REPO_MIRROR" ".git"
    git init
    git config --bool core.bare false

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

    pr_commits=($(git for-each-ref --format='%(refname:lstrip=2):%(objectname)'))
    for pr_commit in "${pr_commits[@]}"; do
      pr_commit_split=(${pr_commit//:/ })
      pr_commit_name=${pr_commit_split[0]}
      pr_commit_hash=${pr_commit_split[1]}
      if [[ "$pr_commit_name" =~ pr.*head ]]; then
        echo "$(git checkout -f -b "$pr_commit_name" "$pr_commit_hash")"
      fi
    done

    # loop through all branches, both local and remote
    for branch in $(git branch -a); do
      if [[ ! "$branch" =~ "HEAD" ]]; then
        local_branch=${branch#remotes/origin/} # remove the remote prefix
        if [[ ! "$local_branch" =~ ^master$|^dev$ ]]; then # skip master and dev branch
          if ! git show-ref --verify --quiet refs/heads/$local_branch; then # check if the branch exists locally
            git branch --track "$local_branch" "$branch" && echo "$local_branch" created and set up to track "$branch"
          fi
        fi
      fi
    done

    if pull=$(git pull --all --rebase 2>&1); then
      printf '%s
    ' "$pull"
    else
      echo "git pull failed; exited with $?" >&2
      exit 1
    fi

    if lfs_pull=$(git lfs pull 2>&1); then
      printf '%s
    ' "$lfs_pull"
    else
      echo "git lfs pull failed; exited with $?" >&2
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

    cd "$REPO_DIR"


    branches=($(git for-each-ref --format='%(refname:lstrip=2)' refs/heads/ | sort))

    sorted_branches=()
    for branch in "${branches[@]}"
    do
      commit_count=$(git rev-list --count "refs/heads/$branch")
      sorted_branches+=("$commit_count:$branch")
    done

    sorted_branches_sorted=($(echo "${sorted_branches[@]}" | tr ' ' '\n' | sort -nr | cut -d':' -f2))

    # Parallelization is not fully tested yet
    # export -f push_small_commits_in_parallel

    num_branches=0
    for ((; num_branches<${#sorted_branches_sorted[@]}; num_branches+=1)); do
        push_small_commits_to_branch "${sorted_branches_sorted[num_branches]}"
        # Parallelization is not fully tested yet
        # if (($num_branches % 3 == 0 || $num_branches == 0)); then
        #     arr=()
        #     arr+=("${sorted_branches_sorted[num_branches]}")
        #     arr+=("${sorted_branches_sorted[num_branches+1]}")
        #     arr+=("${sorted_branches_sorted[num_branches+2]}")
        #     push_small_commits_in_parallel "${arr[@]}"
        # fi
    done

    # Parallelization is not fully tested yet
    # if ((num_branches % 3 == 1)); then
    #   push_small_commits_to_branch "${filtered_branches[num_branches-1]}"
    # elif ((num_branches % 3 == 2)); then
    #   push_small_commits_to_branch "${filtered_branches[num_branches-2]}"
    #   push_small_commits_to_branch "${filtered_branches[num_branches-1]}"
    # fi


    # # Push all changes to the remote repository
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

    # createIssues=$(node createIssues.js)
    # echo "$createIssues"

    # createComment=$(node createComments.js)
    # echo "$createComment"

    # updateIssue=$(node updateIssues.js)
    # echo "$updateIssue"

    # deleteBranches=$(node deleteBranches.js)
    # echo "$deleteBranches"

    # createReleases=$(node createReleases.js)
    # echo "$createReleases"

    # echo "Migration completed successfully!"
    # display_txt_file "mettons.txt"

}

main