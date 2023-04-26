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

push_lfs_objects_to_branch()
{
    local branch="$1"
    printf "Pushing lfs objects to: %s\n" "$branch"

    # Checkout the given branch
    # echo $(git switch -C "$branch")
    echo "$(git checkout "$branch")"
    echo "$(git lfs fetch "$branch")"
    echo "$(git lfs checkout)"

    # Push all git-lfs files to the given branch
    echo $(git lfs push "$TARGET_SSH" "$branch" )
}
# Pushing small commits to the given branch.
push_small_commits_to_branch()
{
    local branch="$1"
    local hash="$2"
    printf "Pushing small commits to: %s\n" "$branch"

    echo $(git push "$TARGET_SSH" "$(git rev-list --reverse --max-count=1 $hash):$branch" )

    # Reverse the order of commits and push them one by one
    for commit in $(git rev-list --reverse $hash | ruby -ne 'i ||= 0; i += 1; puts $_ if i % 10 == 0'); do
        echo $(git push --force "$TARGET_SSH" "$commit:$branch")
    done

    # Push tags related to the given branch
    echo $(git push "$TARGET_SSH" "$branch" )
    echo $(git push "$TARGET_SSH" "$branch" --tags)
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
    # # Run the node test.js script
    # echo "$(src_test)"
    # echo "$(target_test)"


    # if clone_mirror=$(git clone --mirror "$SRC_SSH" "$REPO_MIRROR" >/dev/null 2>&1); then
    #   printf '%s
    # ' "$clone_mirror"
    #   echo "Successfully cloned $SRC_SSH to $REPO_MIRROR"
    # else
    #   echo "Failed to clone $SRC_SSH; exited with $?" >&2
    #   exit 1
    # fi

    # if fetch=$(node fetch.js 2>&1); then
    #   printf '%s
    # ' "$fetch"
    # else
    #   echo "node fetch.js failed; exited with $?" >&2
    #   exit 1
    # fi

    # if rewriteRefs=$(node rewriteRefs.js 2>&1); then
    #   printf '%s
    # ' "$rewriteRefs"
    # else
    #   echo "node rewriteRefs.js failed; exited with $?" >&2
    #   exit 1
    # fi

    # cd "$REPO_MIRROR"

    # refs=$(cat packed-refs | awk '$2 ~ /^refs\/heads/{print $2}')
    # refs_array=($refs)
    # hashes=$(cat packed-refs | awk '$2 ~ /^refs\/heads/{print $1}')
    # hashes_array=($hashes)

    # for ((i=0; i<${#hashes_array[@]}; i++)); do
    #   local commit_count="$(git rev-list --count ${hashes_array[i]})"
    #   local dummy_hash="${hashes_array[i]}"
    #   local dummy_ref="${refs_array[i]}"
    #   echo "i: $i"
    #   j=$((i-1))
    #   while ((j>=0)) && [[ "$(git rev-list --count ${hashes_array[j]})" > "$commit_count" ]]; do
    #     refs_array[j+1]="${refs_array[j]}"
    #     hashes_array[j+1]="${hashes_array[j]}"
    #     j=$((j-1))
    #     echo "j: $j"
    #   done
    #   refs_array[j+1]="$dummy_ref"
    #   hashes_array[j+1]="$dummy_hash"
    # done

    # mkdir "branches"
    # cd "branches"

    # echo "${refs_array[@]}" > refs.txt
    # echo "${hashes_array[@]}" > hashes.txt

    # for ((i=0; i<${#hashes_array[@]}; i++)); do
    #   echo "${hashes_array[i]} ${refs_array[i]}"
    # done

    cd branches
    refs_array=($(cat refs.txt))
    hashes_array=($(cat hashes.txt))
    cd ..
    cd $REPO_MIRROR


    # Parallelization is not fully tested yet
    export -f push_small_commits_in_parallel

    batch_num=0
    batch_size=8
    for ((; batch_num<$((${#refs_array[@]} / ${batch_size} )); batch_num+=1)); do
        # Parallelization is not fully tested yet
        local refs_parrallel_arr=()
        local hashes_parrallel_arr=()
        for ((i=0; i<8; i++)); do
          refs_parrallel_arr+=("${refs_array[batch_num+i]}")
          hashes_parrallel_arr+=("${hashes_array[batch_num+i]}")
        done
        push_small_commits_in_parallel "${refs_parrallel_arr[@]}" "${hashes_parrallel_arr[@]}"
    done

    # Push the remaining branches
    local refs_parrallel_remaining_arr=()
    local hashes_parrallel_remaining_arr=()
    for ((i=0; i<((${#refs_array[@]} % ${batch_size} )); i++)); do
      refs_parrallel_remaining_arr+=("${refs_array[batch_num+i]}")
      hashes_parrallel_remaining_arr+=("${hashes_array[batch_num+i]}")
    done
    push_small_commits_in_parallel "${refs_parrallel_remaining_arr[@]}" "${hashes_parrallel_remaining_arr[@]}"

    echo $(git push "$TARGET_SSH" --mirror)


    # # Create a new directory to store the cloned repository and move the mirrored repository inside
    # mkdir "$REPO_DIR"
    # mv "$REPO_MIRROR" "$REPO_DIR"
    # cd "$REPO_DIR"

    # mv "$REPO_MIRROR" ".git"
    # git init
    # git config --bool core.bare false

    # if fetch_all=$(git fetch --all --tags --update-head-ok 2>&1); then
    #   printf '%s
    #   ' "$fetch_all"
    # else
    #   echo "git fetch failed; exited with $?" >&2
    #   exit 1
    # fi


    # if fetch_lfs_all=$(git lfs fetch --all 2>&1); then
    #   printf '%s
    # ' "$fetch_lfs_all"
    # else
    #   echo "git lfs fetch failed; exited with $?" >&2
    #   exit 1
    # fi

    # if pull=$(git pull --all --rebase 2>&1); then
    #   printf '%s
    # ' "$pull"
    # else
    #   echo "git pull failed; exited with $?" >&2
    #   exit 1
    # fi

    # if lfs_pull=$(git lfs pull 2>&1); then
    #   printf '%s
    # ' "$lfs_pull"
    # else
    #   echo "git lfs pull failed; exited with $?" >&2
    #   exit 1
    # fi

    # # Push all changes to the remote repository
    # echo $(git push "$TARGET_SSH" --all)
    # echo $(git lfs push "$TARGET_SSH" --all)
    # cd ..

    # if createBranches=$(node createBranches.js 2>&1); then
    #   printf '%s
    # ' "$createBranches"
    # else
    #   echo "node createBranches.js failed; exited with $?" >&2
    #   exit 1
    # fi

    # if createIssues=$(node createIssues.js 2>&1); then
    #   printf '%s
    # ' "$createIssues"
    # else
    #   echo "node createIssues.js failed; exited with $?" >&2
    #   exit 1
    # fi

    # if createComment=$(node createComments.js 2>&1); then
    #   printf '%s
    # ' "$createComment"
    # else
    #   echo "node createComments.js failed; exited with $?" >&2
    #   exit 1
    # fi

    # if updateIssue=$(node updateIssues.js 2>&1); then
    #   printf '%s
    # ' "$updateIssue"
    # else
    #   echo "node updateIssues.js failed; exited with $?" >&2
    #   exit 1
    # fi

    # if deleteBranches=$(node deleteBranches.js 2>&1); then
    #   printf '%s
    # ' "$deleteBranches"
    # else
    #   echo "node deleteBranches.js failed; exited with $?" >&2
    #   exit 1
    # fi

    # if createReleases=$(node createReleases.js 2>&1); then
    #   printf '%s
    # ' "$createReleases"
    # else
    #   echo "node createReleases.js failed; exited with $?" >&2
    #   exit 1
    # fi

    # echo "Migration completed successfully!"
    # display_txt_file "mettons.txt"
}

main