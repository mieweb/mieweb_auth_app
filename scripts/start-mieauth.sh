#!/bin/bash
# Wrapper script for systemd to start MIEAuth with proper environment
# This sources the original set-env.sh which handles multi-line JSON properly
source /home/aabrol/scripts/set-env.sh
exec /home/aabrol/.nvm/versions/node/v20.19.6/bin/node main.js
