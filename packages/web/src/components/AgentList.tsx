import { Server, Users, User2, Radio, Wifi, WifiOff } from 'lucide-react'
import { useStore } from '../store/index.ts'
import { cn } from '@/lib/utils.ts'

export function AgentList() {
  const { agents, selectedAgentId, selectAgent, connected, connectionInitialized } = useStore()

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 border-b border-border/50 backdrop-blur-md bg-background/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Server className="h-4 w-4 text-purple-400" />
            <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
              Agent 列表
            </span>
          </h3>
          {connectionInitialized ? (
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-purple-500/5 border border-purple-500/10">
              {connected ? (
                <Wifi className="h-3 w-3 text-green-400" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-400" />
              )}
              <span className="text-xs text-muted-foreground">{connected ? '已连接' : '离线'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-purple-500/5 border border-purple-500/10">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
              <span className="text-xs text-muted-foreground">连接中...</span>
            </div>
          )}
        </div>

        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-purple-400/60" />
            <span>{agents.length} 个代理</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400/60" />
            <span>{selectedAgentId ? '指定代理' : '广播模式'}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!connectionInitialized ? (
          // 加载骨架屏
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg animate-pulse">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-purple-500/10 rounded" />
                  <div className="h-2 w-16 bg-purple-500/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500/10 to-purple-600/10 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-purple-400/40" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">暂无 Agent 连接</p>
            <p className="text-xs text-muted-foreground/60">等待 Agent 接入...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {agents.map(agent => (
              <div
                key={agent.id}
                className={cn(
                  'relative flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-200',
                  'hover:bg-purple-500/5 hover:border-purple-500/20',
                  'border border-transparent',
                  selectedAgentId === agent.id &&
                    'bg-purple-500/10 border-purple-500/30 shadow-lg shadow-purple-500/5'
                )}
                onClick={() => selectAgent(agent.id)}
              >
                {selectedAgentId === agent.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-purple-400 to-purple-600 rounded-r" />
                )}

                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-200',
                      selectedAgentId === agent.id
                        ? 'bg-gradient-to-r from-purple-400 to-purple-600 shadow-lg shadow-purple-500/20'
                        : 'bg-purple-500/10'
                    )}
                  >
                    <User2
                      className={cn(
                        'h-5 w-5',
                        selectedAgentId === agent.id ? 'text-white' : 'text-purple-400'
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {agent.id.substring(0, 8)}...
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-green-400">在线</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border/50 p-4">
          <button
            onClick={() => selectAgent(null)}
            className={cn(
              'w-full py-3 px-4 rounded-lg transition-all duration-200 text-sm font-medium',
              'flex items-center justify-center gap-2',
              !selectedAgentId
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'bg-purple-500/5 hover:bg-purple-500/10 text-purple-400 border border-purple-500/20'
            )}
          >
            <Radio className="h-4 w-4" />
            {selectedAgentId ? '切换到广播模式' : '当前: 广播模式'}
          </button>
        </div>
      </div>
    </div>
  )
}
