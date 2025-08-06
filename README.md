# Claude-Remote MVP

A minimal viable product for Claude-Remote system with Server, Agent, and Web chat interface.

## Quick Start

### 1. Install dependencies
```bash
pnpm install
```

### 2. Start the Server
```bash
pnpm run dev:server
```
Server will run on http://localhost:3000

### 3. Start the Web interface
In a new terminal:
```bash
pnpm run dev:web
```
Web interface will be available at http://localhost:5173

### 4. Start an Agent
In another terminal:
```bash
cd packages/client
pnpm run dev -- start --name "Agent-1"
```

You can start multiple agents with different names:
```bash
pnpm run dev -- start --name "Agent-2" --server http://localhost:3000
```

## Usage

1. Open the web interface at http://localhost:5173
2. You'll see connected agents in the left sidebar
3. Click on an agent to chat with it specifically, or leave unselected to broadcast to all
4. Type messages and press Enter to send
5. Agents will receive messages in their terminal and can type replies

## Features

- ✅ Real-time WebSocket communication
- ✅ Multiple agents support
- ✅ Web-based chat interface
- ✅ Agent selection for targeted messaging
- ✅ Broadcast to all agents
- ✅ Connection status indicators
- ✅ Auto-reconnection for agents

## Architecture

- **Server**: NestJS with Socket.io
- **Agent**: Node.js CLI with Socket.io client
- **Web**: React 19 with Zustand and Ant Design