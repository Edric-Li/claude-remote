// Worker control messages
export interface WorkerStartMessage {
  type: 'worker:start'
  taskId: string
  workingDirectory?: string
  args?: string[]
}

export interface WorkerInputMessage {
  type: 'worker:input'
  taskId: string
  input: string
}

export interface WorkerOutputMessage {
  type: 'worker:output'
  taskId: string
  output: string
  outputType: 'stdout' | 'stderr'
}

export interface WorkerStatusMessage {
  type: 'worker:status'
  taskId: string
  status: 'started' | 'stopped' | 'completed' | 'error'
  error?: string
  exitCode?: number
}