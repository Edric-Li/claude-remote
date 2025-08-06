import { List, Typography, Tag, Empty } from 'antd'
import { useStore } from '../store/index.ts'
import styles from './AgentList.module.css'

const { Title, Text } = Typography

export function AgentList(): JSX.Element {
  const { agents, selectedAgentId, selectAgent, connected } = useStore()
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={5}>Connected Agents</Title>
        <Tag color={connected ? 'success' : 'error'}>
          {connected ? 'Connected' : 'Disconnected'}
        </Tag>
      </div>
      
      {agents.length === 0 ? (
        <Empty 
          description="No agents connected" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          dataSource={agents}
          renderItem={(agent) => (
            <List.Item
              className={`${styles.agentItem} ${selectedAgentId === agent.id ? styles.selected : ''}`}
              onClick={() => selectAgent(agent.id)}
            >
              <div>
                <Text strong>{agent.name}</Text>
                <br />
                <Text type="secondary" className={styles.agentId}>
                  {agent.id.substring(0, 8)}...
                </Text>
              </div>
              <Tag color="green">Online</Tag>
            </List.Item>
          )}
        />
      )}
      
      <div className={styles.footer}>
        <Text type="secondary" onClick={() => selectAgent(null)} style={{ cursor: 'pointer' }}>
          {selectedAgentId ? 'Click to broadcast to all' : 'Broadcasting to all agents'}
        </Text>
      </div>
    </div>
  )
}