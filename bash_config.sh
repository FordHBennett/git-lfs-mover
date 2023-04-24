# Source repo ssh
SRC_SSH=""

# Target repo ssh
TARGET_SSH=""

# Source repo directory path
REPO_DIR=""

# Source repo mirror path
REPO_MIRROR="$REPO_DIR.git"

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
