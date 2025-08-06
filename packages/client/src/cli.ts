#!/usr/bin/env node
import { Command } from 'commander'
import { startAgent } from './agent.js'

const program = new Command()

program
  .name('claude-remote-agent')
  .description('Claude Remote Agent - Connect to Claude Remote Server')
  .version('0.1.0')

program
  .command('start')
  .description('Start the agent and connect to server')
  .option('-s, --server <url>', 'Server URL', 'http://localhost:3000')
  .option('-n, --name <name>', 'Agent name', 'Agent')
  .action(async (options) => {
    await startAgent({
      serverUrl: options.server,
      name: options.name
    })
  })

program.parse()