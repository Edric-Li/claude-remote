import { useState, useRef, useEffect } from 'react'
import { Input, Button, Typography, Card, Empty } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { useStore } from '../store/index.ts'
import dayjs from 'dayjs'
import styles from './ChatPanel.module.css'

const { Title, Text } = Typography

export function ChatPanel(): JSX.Element {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { messages, selectedAgentId, agents, sendMessage } = useStore()
  
  const selectedAgent = agents.find(a => a.id === selectedAgentId)
  
  const filteredMessages = selectedAgentId 
    ? messages.filter(m => {
        // Show messages that:
        // 1. Are from this specific agent
        // 2. Are from web TO this specific agent
        // 3. Are from web to ALL (no agentId)
        if (m.from === 'agent') {
          return m.agentId === selectedAgentId
        } else {
          return !m.agentId || m.agentId === selectedAgentId
        }
      })
    : messages
  
  const handleSend = (): void => {
    if (inputValue.trim()) {
      sendMessage(inputValue)
      setInputValue('')
    }
  }
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filteredMessages])
  
  return (
    <Card className={styles.container}>
      <div className={styles.header}>
        <Title level={4}>
          Chat with {selectedAgent ? selectedAgent.name : 'All Agents'}
        </Title>
      </div>
      
      <div className={styles.messages}>
        {filteredMessages.length === 0 ? (
          <Empty 
            description="No messages yet. Start a conversation!" 
            className={styles.empty}
          />
        ) : (
          filteredMessages.map((message) => {
            const agent = agents.find(a => a.id === message.agentId)
            return (
              <div 
                key={message.id} 
                className={`${styles.message} ${message.from === 'web' ? styles.web : styles.agent}`}
              >
                <div className={styles.messageHeader}>
                  <Text strong>
                    {message.from === 'web' ? 'You' : agent?.name || 'Agent'}
                  </Text>
                  <Text type="secondary" className={styles.time}>
                    {dayjs(message.timestamp).format('HH:mm:ss')}
                  </Text>
                </div>
                <div className={styles.messageContent}>
                  {message.content}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className={styles.inputArea}>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={handleSend}
          placeholder="Type a message..."
          size="large"
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          size="large"
        >
          Send
        </Button>
      </div>
    </Card>
  )
}