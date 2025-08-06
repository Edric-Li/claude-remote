// Claude control messages
export interface ClaudeStartMessage {
  type: 'claude:start'
  taskId: string
  workingDirectory?: string
  args?: string[]
}

export interface ClaudeInputMessage {
  type: 'claude:input'
  taskId: string
  input: string
}

export interface ClaudeOutputMessage {
  type: 'claude:output'
  taskId: string
  output: string
  outputType: 'stdout' | 'stderr'
}

export interface ClaudeStatusMessage {
  type: 'claude:status'
  taskId: string
  status: 'started' | 'stopped' | 'error'
  error?: string
  exitCode?: number
}