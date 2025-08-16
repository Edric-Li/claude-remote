import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException
} from '@nestjs/common'
import { AgentRepository, AgentFilters, PaginationOptions, PaginatedResult } from '../repositories/agent.repository'
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
}

@Injectable()
export class AgentService {
  constructor(
    private readonly agentRepository: AgentRepository
  ) {}

  /**
   * 创建新的Agent
   */
  async create(createAgentDto: CreateAgentDto): Promise<Agent> {
    const { name, description, maxWorkers, tags, allowedTools, createdBy } = createAgentDto

    // 检查名称是否已存在
    const existingAgent = await this.agentRepository.findByName(name)
    if (existingAgent) {
      throw new ConflictException(`Agent with name "${name}" already exists`)
    }

    // 生成唯一的密钥
    const secretKey = this.generateSecretKey()

    const agent = await this.agentRepository.create({
      name,
      description,
      secretKey,
      maxWorkers,
      tags: tags || [],
      allowedTools: allowedTools || [],
      createdBy,
      status: 'pending'
    })

    return agent
  }

  /**
   * 获取所有Agent
   */
  async findAll(
    filters?: AgentFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Agent>> {
    return this.agentRepository.findWithFilters(filters, pagination)
  }

  /**
   * 根据ID获取Agent
   */
  async findOne(id: string): Promise<Agent> {
    const agent = await this.agentRepository.findById(id)
    if (!agent) {
      throw new NotFoundException(`Agent with ID "${id}" not found`)
    }
    return agent
  }

  /**
   * 更新Agent
   */
  async update(id: string, updateAgentDto: UpdateAgentDto): Promise<Agent> {
    const agent = await this.findOne(id)

    // 如果更新名称，检查是否与其他Agent冲突
    if (updateAgentDto.name && updateAgentDto.name !== agent.name) {
      const existingAgent = await this.agentRepository.findByName(updateAgentDto.name)
      if (existingAgent && existingAgent.id !== id) {
        throw new ConflictException(`Agent with name "${updateAgentDto.name}" already exists`)
      }
    }

    const updatedAgent = await this.agentRepository.update(id, updateAgentDto)
    return updatedAgent
  }

  /**
   * 删除Agent
   */
  async remove(id: string): Promise<void> {
    const agent = await this.findOne(id)
    await this.agentRepository.delete(id)
  }

  /**
   * 根据密钥查找Agent
   */
  async findBySecretKey(secretKey: string): Promise<Agent | null> {
    return this.agentRepository.findBySecretKey(secretKey)
  }

  /**
   * 生成密钥
   */
  private generateSecretKey(): string {
    return crypto.randomBytes(16).toString('hex')
  }

  /**
   * 重置Agent密钥
   */
  async resetSecretKey(id: string): Promise<string> {
    const agent = await this.findOne(id)
    const newSecretKey = this.generateSecretKey()
    
    await this.agentRepository.update(id, { secretKey: newSecretKey })
    return newSecretKey
  }

  /**
   * 获取Agent统计信息
   */
  async getStatistics(): Promise<any> {
    return { total: 0, byStatus: {}, byPlatform: {}, recentlyActive: 0, withMonitoring: 0 }
  }

  /**
   * 批量操作Agent - 简化版本
   */
  async performBatchOperation(operation: any): Promise<any> {
    return { successCount: 0, failureCount: 0, skippedCount: 0, totalCount: 0, results: [] }
  }

  // 兼容方法 - 映射到新方法
  async getAllAgents(createdBy?: string) {
    const result = await this.findAll()
    return result.items
  }

  async getConnectedAgents() {
    const result = await this.findAll({ status: 'connected' })
    return result.items
  }

  async getAgentById(id: string) {
    return this.findOne(id)
  }

  async updateAgent(id: string, updateDto: UpdateAgentDto) {
    return this.update(id, updateDto)
  }

  async deleteAgent(id: string) {
    return this.remove(id)
  }

  async disconnectAgent(id: string): Promise<void> {
    await this.update(id, { status: 'offline' } as any)
  }

  async updateAgentStatus(id: string, updates: any) {
    return this.update(id, updates)
  }

  async validateAgentKey(secretKey: string) {
    return this.findBySecretKey(secretKey)
  }
}