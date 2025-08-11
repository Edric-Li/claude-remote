import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException
} from '@nestjs/common'
import { AgentRepository } from '../repositories/agent.repository'
import { Agent } from '../entities/agent.entity'
import * as crypto from 'crypto'

export interface CreateAgentDto {
  name: string
  description?: string
  maxWorkers: number
  tags?: string[]
  allowedTools?: string[]
  createdBy: string
}

export interface UpdateAgentDto {
  name?: string
  description?: string
  maxWorkers?: number
  tags?: string[]
  allowedTools?: string[]
  workerStrategy?: {
    mode: 'auto' | 'manual' | 'dynamic'
    config: Record<string, any>
  }
}

export interface ConnectAgentDto {
  secretKey: string
  hostname: string
  platform: string
  ipAddress: string
  resources: {
    cpuCores: number
    memory: number
    diskSpace: number
  }
}

@Injectable()
export class AgentService {
  constructor(private readonly agentRepository: AgentRepository) {}

  /**
   * 生成唯一的密钥
   */
  private generateSecretKey(): string {
    const segments = []
    for (let i = 0; i < 4; i++) {
      segments.push(crypto.randomBytes(2).toString('hex').toUpperCase())
    }
    return `AIO-${segments.join('-')}`
  }

  /**
   * 创建新的 Agent
   */
  async createAgent(data: CreateAgentDto): Promise<Agent> {
    // 生成唯一密钥
    let secretKey = this.generateSecretKey()
    let attempts = 0

    // 确保密钥唯一
    while (!(await this.agentRepository.isSecretKeyUnique(secretKey)) && attempts < 10) {
      secretKey = this.generateSecretKey()
      attempts++
    }

    if (attempts >= 10) {
      throw new Error('Failed to generate unique secret key')
    }

    const agent = await this.agentRepository.create({
      ...data,
      secretKey,
      status: 'pending'
    })

    return agent
  }

  /**
   * 获取所有 Agent
   */
  async getAllAgents(createdBy?: string): Promise<Agent[]> {
    if (createdBy) {
      return this.agentRepository.findByCreator(createdBy)
    }
    return this.agentRepository.findAll({
      order: {
        createdAt: 'DESC'
      }
    })
  }

  /**
   * 获取单个 Agent
   */
  async getAgentById(id: string): Promise<Agent> {
    const agent = await this.agentRepository.findById(id)
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`)
    }
    return agent
  }

  /**
   * 更新 Agent
   */
  async updateAgent(id: string, data: UpdateAgentDto): Promise<Agent> {
    await this.getAgentById(id) // 确保存在

    const updated = await this.agentRepository.update(id, data)
    if (!updated) {
      throw new Error('Failed to update agent')
    }

    return updated
  }

  /**
   * 删除 Agent
   */
  async deleteAgent(id: string): Promise<void> {
    const agent = await this.getAgentById(id)

    // 不能删除已连接的 Agent
    if (agent.status === 'connected') {
      throw new ConflictException('Cannot delete a connected agent')
    }

    const deleted = await this.agentRepository.delete(id)
    if (!deleted) {
      throw new Error('Failed to delete agent')
    }
  }

  /**
   * 重置 Agent 密钥
   */
  async resetSecretKey(id: string): Promise<string> {
    const agent = await this.getAgentById(id)

    // 不能重置已连接的 Agent 密钥
    if (agent.status === 'connected') {
      throw new ConflictException('Cannot reset key for a connected agent')
    }

    let secretKey = this.generateSecretKey()
    let attempts = 0

    while (!(await this.agentRepository.isSecretKeyUnique(secretKey, id)) && attempts < 10) {
      secretKey = this.generateSecretKey()
      attempts++
    }

    await this.agentRepository.update(id, { secretKey })

    return secretKey
  }

  /**
   * 验证并连接 Agent
   */
  async validateAndConnect(data: ConnectAgentDto): Promise<Agent> {
    const agent = await this.agentRepository.findBySecretKey(data.secretKey)

    if (!agent) {
      throw new BadRequestException('Invalid secret key')
    }

    if (agent.status === 'connected') {
      throw new ConflictException('Agent already connected')
    }

    // 更新连接信息
    const updated = await this.agentRepository.update(agent.id, {
      status: 'connected',
      hostname: data.hostname,
      platform: data.platform,
      ipAddress: data.ipAddress,
      resources: data.resources,
      lastSeenAt: new Date()
    })

    if (!updated) {
      throw new Error('Failed to update agent connection')
    }

    return updated
  }

  /**
   * 断开 Agent 连接
   */
  async disconnectAgent(id: string): Promise<void> {
    await this.agentRepository.setOffline(id)
  }

  /**
   * 更新 Agent 最后活跃时间
   */
  async updateLastSeen(id: string): Promise<void> {
    await this.agentRepository.updateLastSeen(id)
  }

  /**
   * 获取已连接的 Agent
   */
  async getConnectedAgents(): Promise<Agent[]> {
    return this.agentRepository.findConnectedAgents()
  }

  /**
   * 根据密钥获取 Agent
   */
  async getAgentBySecretKey(secretKey: string): Promise<Agent | null> {
    return this.agentRepository.findBySecretKey(secretKey)
  }

  /**
   * 验证 Agent 密钥
   */
  async validateAgentKey(secretKey: string): Promise<Agent | null> {
    if (!secretKey) {
      return null
    }
    return this.agentRepository.findBySecretKey(secretKey)
  }

  /**
   * 更新 Agent 状态
   */
  async updateAgentStatus(
    id: string,
    updates: {
      status?: 'pending' | 'connected' | 'offline'
      lastSeenAt?: Date
      ipAddress?: string
    }
  ): Promise<void> {
    const updateData: any = {}

    if (updates.status) {
      updateData.status = updates.status
    }
    if (updates.lastSeenAt) {
      updateData.lastSeenAt = updates.lastSeenAt
    }
    if (updates.ipAddress) {
      updateData.ipAddress = updates.ipAddress
    }

    await this.agentRepository.update(id, updateData)
  }
}
