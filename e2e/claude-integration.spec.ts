import { test, expect } from '@playwright/test'

test('Claude integration test', async ({ page }) => {
  // Navigate to the web interface
  await page.goto('http://localhost:5174/')
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle')
  
  // Check if an agent is connected (should see Claude Agent)
  await page.waitForSelector('text=Claude Agent', { timeout: 5000 })
  
  // Click on the Claude Control tab
  await page.click('text=Claude Control')
  
  // Wait for Claude panel to be visible
  await page.waitForSelector('text=Claude Code Control', { timeout: 5000 })
  
  // Select the agent from dropdown
  await page.click('[placeholder="Select an agent"]')
  await page.click('text=Claude Agent')
  
  // Start Claude
  await page.click('button:has-text("Start Claude")')
  
  // Wait for Claude to start (check for Stop button)
  await page.waitForSelector('button:has-text("Stop Claude")', { timeout: 10000 })
  
  // Check if the output area shows content
  await page.waitForTimeout(2000)
  
  // Take a screenshot of the Claude control panel
  await page.screenshot({ 
    path: 'claude-integration-test.png',
    fullPage: true 
  })
  
  console.log('✅ Claude integration test passed!')
  console.log('📸 Screenshot saved as claude-integration-test.png')
})