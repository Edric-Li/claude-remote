export interface Agent {
  id: string
  name: string
  description: string
  secretKey: string
  maxWorkers: number
  status: 'pending' | 'connected' | 'offline'
  hostname?: string
  platform?: string
  ipAddress?: string
  resources?: {
    cpuCores: number
    memory: number
    diskSpace: number
  }
  tags?: string[]
  allowedTools?: string[]
  lastSeenAt?: string
  lastValidatedAt?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  metadata?: {
    lastValidationResult?: ValidationResult
    monitoringConfig?: MonitoringConfig
    alertRules?: AlertRule[]
    permissions?: PermissionConfig
  }
}

export interface ValidationResult {
  success: boolean
  timestamp: Date
  responseTime?: number
  errorMessage?: string
  warnings?: string[]
  metrics?: {
    connectivity: boolean
    authentication: boolean
    resourceAvailability: boolean
  }
}

export interface MonitoringConfig {
  enabled: boolean
  heartbeatInterval: number
  checkInterval?: number
  alertThresholds: {
    cpuUsage: number
    memoryUsage: number
    diskUsage: number
    responseTime: number
  }
  notificationChannels: string[]
}

export interface AlertRule {
  id: string
  name: string
  condition: string
  threshold: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  metric?: string
  cooldownPeriod?: number
}

export interface PermissionConfig {
  allowedOperations: string[]
  accessLevel: 'read' | 'write' | 'admin'
  restrictions: string[]
}

export interface AgentFormData {
  name: string
  description: string
  maxWorkers: number
  tags?: string[]
  allowedTools?: string[]
}

export interface AgentFilters {
  search?: string
  status?: 'pending' | 'connected' | 'offline'
  tags?: string[]
  platform?: string
  lastSeenAfter?: Date
  lastSeenBefore?: Date
  hasValidationResult?: boolean
  monitoringEnabled?: boolean
}

export interface PaginationOptions {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface BatchOperation {
  type: 'delete' | 'update_status' | 'update_tags' | 'update_monitoring'
  agentIds: string[]
  payload?: any
}

export interface BatchOperationResult {
  totalCount: number
  successCount: number
  failureCount: number
  skippedCount: number
  results: Array<{
    agentId: string
    success: boolean
    error?: string
    skipped?: boolean
    reason?: string
  }>
}

export interface ConnectionTestResult {
  success: boolean
  message: string
  timestamp: Date
  responseTime?: number
  details?: any
}

export interface AgentStatistics {
  total: number
  byStatus: Record<string, number>
  byPlatform: Record<string, number>
  recentlyActive: number
  withMonitoring: number
}