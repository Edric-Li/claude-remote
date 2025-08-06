import { useState, useRef, useEffect } from 'react'
import { Card, Button, Input, Typography, Select, Space } from 'antd'
import { PlayCircleOutlined, StopOutlined, SendOutlined } from '@ant-design/icons'
import { useStore } from '../store/index.ts'
import styles from './ClaudePanel.module.css'

const { Title, Text } = Typography
const { TextArea } = Input

export function ClaudePanel(): JSX.Element {
  const [input, setInput] = useState('')
  const [initialPrompt, setInitialPrompt] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)
  
  const { 
    agents, 
    selectedAgentId, 
    claudeOutput, 
    currentTaskId,
    startClaude, 
    sendClaudeInput,
    stopClaude 
  } = useStore()
  
  const selectedAgent = agents.find(a => a.id === selectedAgentId)
  
  const handleStart = (): void => {
    if (!selectedAgentId) {
      alert('Please select an agent first')
      return
    }
    
    startClaude(selectedAgentId, undefined, initialPrompt || undefined)
    setIsRunning(true)
    setInitialPrompt('') // Clear initial prompt after starting
  }
  
  const handleStop = (): void => {
    if (currentTaskId) {
      stopClaude(selectedAgentId!, currentTaskId)
      setIsRunning(false)
    }
  }
  
  const handleSendInput = (): void => {
    if (input.trim() && currentTaskId) {
      // Add user input to output display
      useStore.setState((state) => ({
        claudeOutput: [...state.claudeOutput, {
          type: 'user',
          content: input,
          timestamp: new Date()
        }]
      }))
      
      sendClaudeInput(selectedAgentId!, currentTaskId, input)
      setInput('')
    }
  }
  
  useEffect(() => {
    // Auto-scroll to bottom
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [claudeOutput])
  
  return (
    <Card className={styles.container}>
      <div className={styles.header}>
        <Title level={4}>Claude Code Control</Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Select
              placeholder="Select an agent"
              value={selectedAgentId}
              onChange={(value) => useStore.setState({ selectedAgentId: value })}
              style={{ 
                width: 200,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '8px'
              }}
            >
              {agents.map(agent => (
                <Select.Option key={agent.id} value={agent.id}>
                  {agent.name}
                </Select.Option>
              ))}
            </Select>
            
            {!isRunning ? (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleStart}
                disabled={!selectedAgentId}
                style={{
                  background: 'white',
                  color: '#667eea',
                  border: '2px solid white',
                  fontWeight: '600',
                  borderRadius: '8px'
                }}
              >
                Start Claude
              </Button>
            ) : (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleStop}
                style={{
                  background: 'white',
                  color: '#dc3545',
                  border: '2px solid white',
                  fontWeight: '600',
                  borderRadius: '8px'
                }}
              >
                Stop Claude
              </Button>
            )}
          </Space>
          
          {!isRunning && (
            <Input
              placeholder="Initial prompt (leave empty for default greeting)"
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              onPressEnter={handleStart}
              disabled={!selectedAgentId}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px'
              }}
            />
          )}
        </Space>
      </div>
      
      <div className={styles.output} ref={outputRef}>
        {claudeOutput.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: '#9ca3af', 
            padding: '40px',
            fontSize: '14px'
          }}>
            Claude output will appear here...
          </div>
        ) : (
          claudeOutput.map((item, index) => {
            // Handle both string (legacy) and object formats
            if (typeof item === 'string') {
              return (
                <div key={index} className={styles.assistantMessage}>
                  {item}
                </div>
              )
            }
            
            // Handle structured message objects
            const { type, content, details, stats, usage } = item
            
            if (type === 'user') {
              return (
                <div key={index} className={styles.userMessage}>
                  {content}
                </div>
              )
            } else if (type === 'assistant') {
              return (
                <div key={index} className={styles.assistantMessage}>
                  {content}
                  {usage && (
                    <div className={styles.tokenInfo}>
                      📊 {usage.input_tokens} in / {usage.output_tokens} out
                    </div>
                  )}
                </div>
              )
            } else if (type === 'tool') {
              return (
                <div key={index} className={styles.toolMessage}>
                  <div className={styles.toolHeader}>🔧 {content}</div>
                  {details && (
                    <div className={styles.toolDetails}>
                      {JSON.stringify(details, null, 2).substring(0, 200)}...
                    </div>
                  )}
                </div>
              )
            } else if (type === 'tool-result') {
              return (
                <div key={index} className={styles.toolResult}>
                  <div className={styles.toolResultHeader}>✅ Tool Result</div>
                  <div className={styles.toolResultContent}>{content}</div>
                </div>
              )
            } else if (type === 'result') {
              return (
                <div key={index} className={styles.resultInfo}>
                  <div className={styles.resultHeader}>📊 {content}</div>
                  {stats && (
                    <div className={styles.resultStats}>
                      <span>Turns: {stats.turns}</span>
                      <span>Tokens: {stats.totalTokens}</span>
                      <span>Cost: ${stats.cost.toFixed(6)}</span>
                    </div>
                  )}
                </div>
              )
            } else if (type === 'system') {
              return (
                <div key={index} className={styles.systemMessage}>
                  🌐 {content}
                </div>
              )
            }
            
            return null
          })
        )}
      </div>
      
      <div className={styles.inputArea}>
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault()
              handleSendInput()
            }
          }}
          placeholder="Type input for Claude..."
          autoSize={{ minRows: 2, maxRows: 4 }}
          disabled={!isRunning}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSendInput}
          disabled={!isRunning || !input.trim()}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            height: '40px',
            paddingLeft: '20px',
            paddingRight: '20px',
            boxShadow: '0 2px 4px rgba(102, 126, 234, 0.3)'
          }}
        >
          Send
        </Button>
      </div>
    </Card>
  )
}