#!/bin/bash
# Wrapper script for systemd to start MIEAuth with proper environment.
# set-env.sh is sourced rather than used as an EnvironmentFile because it
# contains multi-line JSON that systemd cannot parse.
source "$HOME/scripts/set-env.sh"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

exec node main.js
