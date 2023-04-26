#!/bin/bash

# get all PIDs of the processes matching the name
pids=$(pgrep -f "/bin/bash ./migrate.sh")
echo $pids

# loop through the PIDs and kill each process
for pid in $pids; do
    kill -9 $pid
done
