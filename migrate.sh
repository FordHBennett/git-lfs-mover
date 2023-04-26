#!/bin/bash -x
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

push_lfs_objects_to_branch()
{
    local branch="$1"
    printf "Pushing lfs objects to: %s\n" "$branch"

    # Checkout the given branch
    # echo $(git switch -C "$branch")
    echo "$(git checkout "$branch")"
    echo "$(git lfs fetch --all "$branch")"
    echo "$(git lfs checkout)"

    # Push all git-lfs files to the given branch
    echo $(git lfs push "$TARGET_SSH" "$branch" )
}
# Pushing small commits to the given branch.
push_small_commits_to_branch()
{
    local branch="$1"
    local hash="$2"

    echo "$(git checkout "$branch")"
    echo "$(git lfs fetch --all "$branch")"
    echo "$(git lfs checkout)"

    echo $(git push "$TARGET_SSH" "$(git rev-list --reverse --max-count=1 $hash):$branch" )


    # TODO: Write a c program to calculate the running size of a commit and if
    # the total size is greater than 2GiB, then push it to the given branch up
    # to the commit before the total size was greater than 2Gib.
    local hash_size=0
    local commit_array=$(git rev-list --reverse $hash)
    for ((i=0;i<${#commit_array[@]}; i+=1)); do
        hash_size+=$(git cat-file -s ${commit_array[i]})
        if [ $hash_size -gt 2147483648 ]; then
          echo $(git push --force "$TARGET_SSH" "${commit_array[i-1]}:$branch")
        fi
    done

    # Push tags related to the given branch
    echo $(git push "$TARGET_SSH" "$branch" )
    echo $(git push "$TARGET_SSH" "$branch" --tags)
    echo $(git lfs push "$TARGET_SSH" "$branch" )
}
push_small_commits_in_parallel() {
    local arr=("$@")
    local refs=()
    local hashes=()

    for((i=0; i<${#arr[@]}/2; i+=1)); do
        refs+=(${arr[i]})
    done
    for((i=${#arr[@]}/2; i<${#arr[@]}; i+=1)); do
        hashes+=(${arr[i]})
    done

    export -f push_small_commits_to_branch # Export the function to make it available for parallelization

    for ((i=0; i<"${#refs[@]}"; i+=1)); do
        push_small_commits_to_branch "${refs[i]}" "${hashes[i]}" &
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


    # Create a new directory to store the cloned repository and move the mirrored repository inside
    # mkdir "$REPO_DIR"
    mv "$REPO_MIRROR" "$REPO_DIR"
    cd "$REPO_DIR"

    mv "$REPO_MIRROR" ".git"
    echo $(git init)
    git config --bool core.bare false

    refs=$(cat packed-refs | awk '$2 ~ /^refs\/heads/{print $2}')
    refs_array=($refs)
    hashes=$(cat packed-refs | awk '$2 ~ /^refs\/heads/{print $1}')
    hashes_array=($hashes)
    for((i=0; i<${#refs_array[@]}; i++)); do
      if [[ ! "${refs_array[i]}" =~ "HEAD" ]]; then
        local_branch=${"${refs_array[i]}"#remotes/origin/} # remove the remote prefix
        if [[ ! "$local_branch" =~ ^master$|^dev$ ]]; then # skip master and dev branch
          echo "$(git checkout -f -b "$local_branch" "${hashes_array[i]}")"
          echo $(git branch --track "$local_branch" "$branch" )
        fi
      fi
    done


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

    # cd ..
    # mkdir "branches"
    # cd "branches"

    # echo "${refs_array[@]}" > refs.txt
    # echo "${hashes_array[@]}" > hashes.txt

    # refs_array=($(cat refs.txt))
    # hashes_array=($(cat hashes.txt))
    # cd ..
    # cd $REPO_MIRROR


    # # Parallelization is not fully tested yet
    # export -f push_small_commits_in_parallel

    batch_num=0
    batch_size=10
    # for ((; batch_num<$((${#refs_array[@]} / ${batch_size} )); batch_num+=1));do
    for ((; batch_num<$((${#refs_array[@]} )); batch_num+=1));do
        push_small_commits_to_branch "${refs_array[batch_num]}" "${hashes_array[batch_num]}"
        # Parallelization is not fully tested yet
        # echo "batch_num: $batch_num"
        # local refs_parrallel_arr=()
        # local hashes_parrallel_arr=()
        # for ((i=0; i<${batch_size}; i++)); do
        #   refs_parrallel_arr+=("${refs_array[batch_num+i]}")
        #   hashes_parrallel_arr+=("${hashes_array[batch_num+i]}")
        # done
        # push_small_commits_in_parallel "${refs_parrallel_arr[@]}" "${hashes_parrallel_arr[@]}"
    done

    # # Push the remaining branches
    # local refs_parrallel_remaining_arr=()
    # local hashes_parrallel_remaining_arr=()
    # for ((i=0; i<((${#refs_array[@]} % ${batch_size} )); i++)); do
    #   refs_parrallel_remaining_arr+=("${refs_array[batch_num+i]}")
    #   hashes_parrallel_remaining_arr+=("${hashes_array[batch_num+i]}")
    # done
    # push_small_commits_in_parallel "${refs_parrallel_remaining_arr[@]}" "${hashes_parrallel_remaining_arr[@]}"

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

main