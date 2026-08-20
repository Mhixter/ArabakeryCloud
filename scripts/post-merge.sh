#!/bin/bash
set -e
npm ci --ignore-scripts
npm run push --workspace=@workspace/db
