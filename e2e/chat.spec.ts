import { test, expect } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

let agentProcess: ChildProcess | null = null

test.describe('Claude Remote Chat', () => {
  test.beforeAll(async () => {
    // Start an agent for testing
    const clientPath = path.join(process.cwd(), 'packages/client')
    agentProcess = spawn('pnpm', ['run', 'dev', '--', 'start', '--name', 'Test-Agent'], {
      cwd: clientPath,
      stdio: 'pipe'
    })
    
    // Wait for agent to connect
    await new Promise(resolve => setTimeout(resolve, 3000))
  })
  
  test.afterAll(async () => {
    // Kill the agent process
    if (agentProcess) {
      agentProcess.kill()
    }
  })

  test('should load the chat interface', async ({ page }) => {
    await page.goto('/')
    
    // Check title
    await expect(page.locator('h3:has-text("Claude Remote - MVP")')).toBeVisible()
    
    // Check agent list section
    await expect(page.locator('h5:has-text("Connected Agents")')).toBeVisible()
    
    // Check connection status
    await expect(page.locator('.ant-tag-success:has-text("Connected")')).toBeVisible()
  })

  test('should show connected agent', async ({ page }) => {
    await page.goto('/')
    
    // Wait for agent to appear
    await page.waitForSelector('text=Test-Agent', { timeout: 5000 })
    
    // Check agent is listed
    await expect(page.locator('text=Test-Agent')).toBeVisible()
    
    // Check online status
    await expect(page.locator('.ant-tag-green:has-text("Online")')).toBeVisible()
  })

  test('should send message to all agents', async ({ page }) => {
    await page.goto('/')
    
    // Wait for UI to load
    await page.waitForSelector('input[placeholder="Type a message..."]')
    
    // Type and send a message
    const testMessage = 'Hello from Playwright test!'
    await page.fill('input[placeholder="Type a message..."]', testMessage)
    await page.click('button:has-text("Send")')
    
    // Check message appears in chat
    await expect(page.locator(`text="${testMessage}"`)).toBeVisible()
    
    // Check message metadata
    await expect(page.locator('text=You')).toBeVisible()
  })

  test('should select specific agent', async ({ page }) => {
    await page.goto('/')
    
    // Wait for agent
    await page.waitForSelector('text=Test-Agent')
    
    // Click on agent to select
    await page.click('text=Test-Agent')
    
    // Check agent is selected (has special styling)
    const agentItem = page.locator('.ant-list-item:has-text("Test-Agent")')
    await expect(agentItem).toHaveClass(/selected/)
    
    // Check chat header updates
    await expect(page.locator('h4:has-text("Chat with Test-Agent")')).toBeVisible()
  })

  test('should broadcast to all when no agent selected', async ({ page }) => {
    await page.goto('/')
    
    // Click on broadcast text
    await page.click('text=Click to broadcast to all')
    
    // Check header shows broadcasting
    await expect(page.locator('h4:has-text("Chat with All Agents")')).toBeVisible()
    
    // Check footer text
    await expect(page.locator('text=Broadcasting to all agents')).toBeVisible()
  })

  test('should handle empty message input', async ({ page }) => {
    await page.goto('/')
    
    // Try to send empty message
    await page.fill('input[placeholder="Type a message..."]', '')
    await page.click('button:has-text("Send")')
    
    // Check no empty message is sent (message count should not increase)
    const messageCount = await page.locator('.message').count()
    
    // Send another empty message
    await page.click('button:has-text("Send")')
    
    // Count should remain the same
    expect(await page.locator('.message').count()).toBe(messageCount)
  })

  test('should display empty state when no messages', async ({ page }) => {
    await page.goto('/')
    
    // Check empty state is visible initially
    await expect(page.locator('text=No messages yet. Start a conversation!')).toBeVisible()
  })

  test('should handle keyboard shortcut (Enter to send)', async ({ page }) => {
    await page.goto('/')
    
    const testMessage = 'Message sent with Enter key'
    await page.fill('input[placeholder="Type a message..."]', testMessage)
    await page.press('input[placeholder="Type a message..."]', 'Enter')
    
    // Check message was sent
    await expect(page.locator(`text="${testMessage}"`)).toBeVisible()
    
    // Check input was cleared
    await expect(page.locator('input[placeholder="Type a message..."]')).toHaveValue('')
  })
})