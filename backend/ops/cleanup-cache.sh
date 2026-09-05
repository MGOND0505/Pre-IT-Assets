#!/bin/bash
# Runs every 48 hours on the live server (installed into cron by the Jenkinsfile deploy stage -
# see its "Ensure cache/log cleanup cron job exists" step). Clears npm's package cache, any build
# tool cache directories, and rotates logs older than 2 days - disk-space housekeeping only, never
# touches dist/ (the actual running build) or node_modules itself.
set -e

cd /var/www/backend

npm cache clean --force

# node_modules/.cache is where some build tools (not this project's plain tsc build, but kept as
# a safety net for anything a future dependency might add) stash their own cache.
rm -rf node_modules/.cache

# pm2's own stdout/stderr log files grow unbounded without pm2-logrotate installed - flush them
# rather than leaving pm2 itself running with no log history at all.
pm2 flush || true

# Any stray log file in the deploy directory older than 2 days (e.g. a leftover app.log from
# before the PM2 migration) - never anything inside node_modules or dist.
find /var/www/backend -maxdepth 1 -name "*.log" -mtime +2 -delete

echo "cleanup-cache.sh ran at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
