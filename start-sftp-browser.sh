#!/bin/bash

# SFTP Browser Quick Start Script
# This script starts the SFTP File Browser server

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   🚀 Starting SFTP File Browser Server                   ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Create required directories
echo "📁 Creating required directories..."
mkdir -p uploads downloads
echo ""

# Start the server
echo "🚀 Starting server..."
echo ""
node sftp-server.js
