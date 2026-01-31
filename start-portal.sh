#!/bin/bash

# Unigenome Portal Startup Script
echo "🚀 Starting Unigenome Deliverables System..."

# 1. Start the Backend Server
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Backend already running on port 3001"
else
    echo "📦 Starting SFTP Backend..."
    node sftp-server.js &
    sleep 3
fi

# 2. Start the React Frontend
echo "🌐 Starting React Portal..."
cd sftp-portal
npm run dev
