#!/bin/bash
cd "$(dirname "$0")"

echo "Pulling latest changes..."
git pull origin claude/monobank-finances-app-FO9hQ
echo

echo "Installing dependencies..."
npm install
echo

echo "Starting dev server..."
# Open browser after 5 seconds
(sleep 5 && open http://localhost:3000) &
npm run dev
