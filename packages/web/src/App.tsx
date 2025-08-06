import { useEffect } from 'react'
import { Layout, Typography, Tabs } from 'antd'
import { AgentList } from './components/AgentList.tsx'
import { ChatPanel } from './components/ChatPanel.tsx'
import { ClaudePanel } from './components/ClaudePanel.tsx'
import { useStore } from './store/index.ts'
import styles from './App.module.css'

const { Header, Sider, Content } = Layout
const { Title } = Typography

export function App(): JSX.Element {
  const connect = useStore((state) => state.connect)
  const disconnect = useStore((state) => state.disconnect)
  
  useEffect(() => {
    connect()
    
    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [connect, disconnect])
  
  return (
    <Layout className={styles.layout}>
      <Header className={styles.header}>
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          Claude Remote - MVP
        </Title>
      </Header>
      <Layout>
        <Sider width={300} className={styles.sider}>
          <AgentList />
        </Sider>
        <Content className={styles.content}>
          <Tabs
            defaultActiveKey="chat"
            items={[
              {
                key: 'chat',
                label: 'Chat',
                children: <ChatPanel />,
              },
              {
                key: 'claude',
                label: 'Claude Control',
                children: <ClaudePanel />,
              },
            ]}
          />
        </Content>
      </Layout>
    </Layout>
  )
}