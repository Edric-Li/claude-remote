import { Server, Circle, Users, User2, Radio } from 'lucide-react'
import { useStore } from '../store/index.ts'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card.tsx'
import { Badge } from './ui/badge.tsx'
import { Skeleton } from './ui/skeleton.tsx'
import { cn } from '@/lib/utils.ts'

export function AgentList() {
  const { agents, selectedAgentId, selectAgent, connected, connectionInitialized } = useStore()
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Connected Agents
          </CardTitle>
          {connectionInitialized ? (
            <Badge 
              variant={connected ? 'default' : 'destructive'}
              className="flex items-center gap-1"
            >
              <Circle className={cn(
                "h-2 w-2 fill-current",
                connected ? "animate-pulse" : ""
              )} />
              {connected ? 'Connected' : 'Disconnected'}
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Circle className="h-2 w-2 fill-current animate-pulse" />
              Connecting...
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {!connectionInitialized ? (
          // Show skeleton loader while connecting
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        ) : agents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No agents connected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Waiting for agents to join...
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={cn(
                  "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-accent",
                  selectedAgentId === agent.id && "bg-accent border-l-4 border-primary"
                )}
                onClick={() => selectAgent(agent.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                    <User2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {agent.id.substring(0, 8)}...
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <Circle className="h-2 w-2 fill-current mr-1" />
                  Online
                </Badge>
              </div>
            ))}
          </div>
        )}
        
        <div className="border-t p-4">
          <button
            onClick={() => selectAgent(null)}
            className={cn(
              "w-full text-center py-2 px-4 rounded-md transition-colors",
              "hover:bg-accent text-sm text-muted-foreground hover:text-foreground",
              !selectedAgentId && "bg-accent"
            )}
          >
            <Radio className="inline-block h-4 w-4 mr-2" />
            {selectedAgentId ? 'Click to broadcast to all' : 'Broadcasting to all agents'}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}