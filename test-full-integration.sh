#!/bin/bash

echo "Claude Remote - Full Integration Test"
echo "====================================="
echo ""

# Kill any existing processes
echo "1. Cleaning up existing processes..."
pkill -f "pnpm run dev" 2>/dev/null
pkill -f "agent-with-claude" 2>/dev/null
pkill -f "tsx.*main.ts" 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# Start the development servers
echo "2. Starting development servers..."
cd /Users/edric/Code/OpenSource/claude-remote
nohup pnpm run dev > dev.log 2>&1 &
DEV_PID=$!
echo "   Development servers started (PID: $DEV_PID)"
sleep 5

# Start the claude agent
echo "3. Starting Claude agent..."
cd packages/client
nohup npx tsx src/agent-with-claude.ts > claude-agent.log 2>&1 &
AGENT_PID=$!
echo "   Claude agent started (PID: $AGENT_PID)"
sleep 3

# Show agent log
echo ""
echo "4. Agent status:"
tail -n 20 claude-agent.log

echo ""
echo "5. Testing instructions:"
echo "   - Open browser at http://localhost:5174/"
echo "   - Click on 'Claude Control' tab"
echo "   - Select 'Claude Agent' from dropdown"
echo "   - Click 'Start Claude' button"
echo "   - You should see Claude output in the terminal area"
echo ""
echo "6. To stop all processes, run:"
echo "   kill $DEV_PID $AGENT_PID"
echo ""
echo "Press Ctrl+C to stop monitoring..."

# Monitor logs
tail -f claude-agent.log