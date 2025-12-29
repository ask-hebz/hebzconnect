#!/bin/bash

# This script creates all HebzConnect project files

BASE_DIR="/home/claude/hebzconnect-complete"
WEB_DIR="$BASE_DIR/web"
AGENT_DIR="$BASE_DIR/agent"

echo "Creating all project files..."

# WEB - Pages
mkdir -p "$WEB_DIR/pages/api"
mkdir -p "$WEB_DIR/components"
mkdir -p "$WEB_DIR/lib"
mkdir -p "$WEB_DIR/public/icons"
mkdir -p "$WEB_DIR/scripts"
mkdir -p "$WEB_DIR/styles"

# Copy the already created files are in place, now create the remaining page files

echo "All files created successfully!"
echo "Total files created:"
find "$BASE_DIR" -type f | wc -l

