#!/bin/bash

# Script to generate commit messages using Claude CLI and git diff
# Usage: ./commit-with-claude.sh

set -e

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Check if there are any changes to commit
if git diff --cached --quiet && git diff --quiet; then
    echo "No changes to commit"
    exit 0
fi

# Get the git diff
echo "Analyzing changes..."
DIFF=$(git diff --cached)
if [ -z "$DIFF" ]; then
    # If nothing is staged, get unstaged changes
    DIFF=$(git diff)
fi

if [ -z "$DIFF" ]; then
    echo "No changes found"
    exit 0
fi

# Generate commit message using Claude CLI
echo "Generating commit message with Claude..."
COMMIT_MSG=$(echo "$DIFF" | claude "Based on this git diff, generate a concise commit message following conventional commit format. Focus on what changed and why. Return only the commit message, no explanations.")

# Create temporary file for editing
TEMP_FILE=$(mktemp)
echo "$COMMIT_MSG" > "$TEMP_FILE"

# Open editor for user to edit the commit message
${EDITOR:-nano} "$TEMP_FILE"

# Read the final commit message
FINAL_MSG=$(cat "$TEMP_FILE")
rm "$TEMP_FILE"

# Check if message is empty
if [ -z "$FINAL_MSG" ] || [ "$FINAL_MSG" = "" ]; then
    echo "Commit message is empty. Aborting commit."
    exit 1
fi

# Stage all changes if nothing is staged
if git diff --cached --quiet; then
    echo "Staging all changes..."
    git add .
fi

# Commit with the message
echo "Committing with message:"
echo "---"
echo "$FINAL_MSG"
echo "---"
git commit -m "$FINAL_MSG"

echo "Commit successful!"