import { useEffect, useState } from 'react'
import { AgentList } from './components/AgentList.tsx'
import { ChatPanel } from './components/ChatPanel.tsx'
import { WorkerPanel } from './components/WorkerPanel.tsx'
import { useStore } from './store/index.ts'
import { MessageCircle, Bot } from 'lucide-react'

export function App() {
  const connect = useStore((state) => state.connect)
  const disconnect = useStore((state) => state.disconnect)
  
  useEffect(() => {
    connect()
    
    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [connect, disconnect])
  
  const [activeTab, setActiveTab] = useState<'chat' | 'worker'>('chat')
  
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-6 py-4 shadow-md">
        <h1 className="text-2xl font-bold">AI Orchestra</h1>
      </header>
      
      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Agent List */}
        <aside className="w-80 border-r bg-card">
          <AgentList />
        </aside>
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col">
          {/* Tab Navigation */}
          <div className="border-b bg-card">
            <div className="flex">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'chat'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageCircle className="h-4 w-4" />
                Chat
              </button>
              <button
                onClick={() => setActiveTab('worker')}
                className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'worker'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Bot className="h-4 w-4" />
                Worker Control
              </button>
            </div>
          </div>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' ? <ChatPanel /> : <WorkerPanel />}
          </div>
        </main>
      </div>
    </div>
  )
}