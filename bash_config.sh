# Source repo ssh
SRC_SSH="git@github.tamu.edu:SpaceCRAFT/Platform.git"

# Target repo ssh
TARGET_SSH="https://github.com/SimDynamX/SC_Platform_Test.git"

# Source repo directory path
REPO_DIR="Platform"

# Source repo mirror path
REPO_MIRROR="Platform.git"

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
