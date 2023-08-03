#!/bin/bash

# get all PIDs of the processes matching the name
pids=$(pgrep -f "./migrate.sh")
echo $pids

# loop through the PIDs and kill each process
for pid in $pids; do
    kill -STOP $pid
done
