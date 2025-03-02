#!/bin/bash

# Simple deployment script for Battle Royale game

echo "Battle Royale Deployment Script"
echo "==============================="

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "Git is not installed. Please install git first."
    exit 1
fi

# Check if repository is initialized
if [ ! -d .git ]; then
    echo "Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit"
else
    echo "Git repository already initialized."
    git add .
    git commit -m "Update before deployment"
fi

# Ask for GitHub repository URL
echo ""
echo "Enter your GitHub repository URL (or press Enter to skip):"
read github_url

if [ -n "$github_url" ]; then
    echo "Adding GitHub remote..."
    git remote add origin $github_url || git remote set-url origin $github_url
    echo "Pushing to GitHub..."
    git push -u origin main || git push -u origin master
    echo "Code pushed to GitHub successfully!"
    echo ""
    echo "Now you can deploy to Render.com or another hosting service."
    echo "See deploy-to-render.md for instructions."
else
    echo "Skipping GitHub push."
    echo "To deploy, you'll need to push to a GitHub repository first."
    echo "See deploy-to-render.md for more information."
fi

echo ""
echo "Deployment preparation complete!" 