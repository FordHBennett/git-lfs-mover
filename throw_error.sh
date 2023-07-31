#!/bin/bash


#Testing the source config
src_test(){
    # Run the node test.js script
    node test.js source

    # Check the exit status of the last executed command
    if [ $? -eq 1 ]; then
    echo "Error: test.js script failed"
    echo "Please check your source config variables in config.js"
    exit 1
    fi
}

#Testing the target config
target_test(){
    # Run the node test.js script
    node test.js target

    # Check the exit status of the last executed command
    if [ $? -eq 1 ]; then
    echo "Error: test.js script failed"
    echo "Please check your target config variables in config.js"
    exit 1
    fi
}

throw_errors(){
    if [ -z "$SRC_SSH" ] || [ -z "$TARGET_SSH" ] || [ -z "$REPO_DIR" ] || [ -z "$REPO_MIRROR" ]; then
        echo "Error: Please set all the required variables in bash_config.sh"
        exit 1
    fi

    if [ -z "$BATCH_SIZE" ]; then
        BATCH_SIZE=1
    fi

    if [ -z "$BRANCH_NUM" ]; then
        BRANCH_NUM=0
    fi


    #Run the node test.js script
    echo "$(src_test)"
    echo "$(target_test)"
}