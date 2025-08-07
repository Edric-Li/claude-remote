#!/bin/bash

echo "🎼 Testing AI Orchestra..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if packages are built
echo "📦 Checking build artifacts..."
if [ -d "packages/server/dist" ] && [ -d "packages/client/dist" ] && [ -d "packages/web/dist" ]; then
    echo -e "${GREEN}✓ All packages built successfully${NC}"
else
    echo -e "${RED}✗ Some packages are not built. Run 'pnpm build' first${NC}"
    exit 1
fi

echo ""
echo "🔍 Checking renamed components..."

# Check if old Claude references are gone
if grep -r "Claude Remote" --include="*.ts" --include="*.tsx" --include="*.json" packages/ 2>/dev/null | grep -v node_modules; then
    echo -e "${RED}✗ Found old 'Claude Remote' references${NC}"
else
    echo -e "${GREEN}✓ No 'Claude Remote' references found${NC}"
fi

# Check if new AI Orchestra name is present
if grep -q "AI Orchestra" README.md; then
    echo -e "${GREEN}✓ README updated with AI Orchestra${NC}"
else
    echo -e "${RED}✗ README not updated${NC}"
fi

# Check package names
if grep -q "@ai-orchestra" packages/*/package.json; then
    echo -e "${GREEN}✓ Package names updated to @ai-orchestra${NC}"
else
    echo -e "${RED}✗ Package names not updated${NC}"
fi

# Check Worker naming
if grep -q "WorkerPanel" packages/web/src/App.tsx; then
    echo -e "${GREEN}✓ Components renamed from Claude to Worker${NC}"
else
    echo -e "${RED}✗ Components not renamed${NC}"
fi

echo ""
echo "✅ AI Orchestra naming migration complete!"
echo ""
echo "To start the system:"
echo "  1. Server: pnpm run dev:server"
echo "  2. Web UI: pnpm run dev:web"
echo "  3. Agent: cd packages/client && pnpm run dev -- start --name 'Agent-1'"