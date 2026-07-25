#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================="
echo "🎨 Starting Design Studio: First Render 🎨"
echo "========================================="

# Get absolute path of script folder
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is not installed or not in PATH."
    exit 1
fi

# Setup python virtual environment if not exists
cd "$DIR/backend"
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "🔌 Activating virtual environment & installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt

# Run backend in the background
echo "⚡ Starting FastAPI Backend on http://localhost:8000..."
uvicorn main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# Trap signals to ensure backend process gets killed when exiting script
cleanup() {
    echo ""
    echo "🛑 Stopping backend server (PID $BACKEND_PID)..."
    kill $BACKEND_PID || true
    echo "👋 Bye!"
}
trap cleanup EXIT

# Setup frontend
cd "$DIR/frontend"
echo "📦 Installing Frontend dependencies..."
npm install

echo "🚀 Starting Frontend dev server..."
npm run dev

# Wait for frontend process
wait
