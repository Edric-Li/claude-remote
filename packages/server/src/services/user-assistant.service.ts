import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In } from 'typeorm'
import { UserAssistant } from '../entities/user-assistant.entity'
import { AssistantRepository } from '../entities/assistant-repository.entity'
import { UserRepository } from '../entities/user-repository.entity'
import { UserAiConfig } from '../entities/user-ai-config.entity'
import {
  CreateAssistantDto,
  UpdateAssistantDto,
  AssistantRepositoryDto
} from '../dto/user-assistant.dto'

@Injectable()
export class UserAssistantService {
  private readonly logger = new Logger(UserAssistantService.name)

  constructor(
    @InjectRepository(UserAssistant)
    private assistantRepository: Repository<UserAssistant>,
    @InjectRepository(AssistantRepository)
    private assistantRepoRepository: Repository<AssistantRepository>,
    @InjectRepository(UserRepository)
    private userRepoRepository: Repository<UserRepository>,
    @InjectRepository(UserAiConfig)
    private aiConfigRepository: Repository<UserAiConfig>,
  ) {}

  async createAssistant(
    userId: string,
    createAssistantDto: CreateAssistantDto
  ): Promise<UserAssistant> {
    // 检查助手名称是否已存在
    const existingName = await this.assistantRepository.findOne({
      where: { userId, name: createAssistantDto.name }
    })
    if (existingName) {
      throw new ConflictException('助手名称已存在')
    }

    // 验证AI配置是否属于用户
    const aiConfig = await this.aiConfigRepository.findOne({
      where: { id: createAssistantDto.aiConfigId, userId }
    })
    if (!aiConfig) {
      throw new BadRequestException('AI配置不存在或不属于当前用户')
    }

    // 验证仓库是否属于用户
    if (createAssistantDto.repositoryIds?.length > 0) {
      const userRepos = await this.userRepoRepository.find({
        where: { id: In(createAssistantDto.repositoryIds), userId }
      })
      if (userRepos.length !== createAssistantDto.repositoryIds.length) {
        throw new BadRequestException('部分仓库不存在或不属于当前用户')
      }
    }

    const assistant = this.assistantRepository.create({
      userId,
      name: createAssistantDto.name,
      description: createAssistantDto.description,
      avatar: createAssistantDto.avatar,
      aiConfigId: createAssistantDto.aiConfigId,
      status: 'creating'
    })

    const savedAssistant = await this.assistantRepository.save(assistant)

    // 创建助手与仓库的关联
    if (createAssistantDto.repositoryIds?.length > 0) {
      await this.addRepositoriesToAssistant(
        savedAssistant.id,
        createAssistantDto.repositoryIds,
        userId
      )
    }

    // 更新状态为active
    savedAssistant.status = 'active'
    await this.assistantRepository.save(savedAssistant)


    this.logger.log(
      `Assistant created: ${savedAssistant.name} (${savedAssistant.id}) for user ${userId}`
    )
    return savedAssistant
  }

  async findUserAssistants(userId: string, status?: string): Promise<UserAssistant[]> {
    const where: any = { userId }
    if (status) {
      where.status = status
    }

    return await this.assistantRepository.find({
      where,
      relations: ['aiConfig', 'repositories', 'repositories.repository'],
      order: { createdAt: 'DESC' }
    })
  }

  async findById(id: string, userId: string): Promise<UserAssistant> {
    const assistant = await this.assistantRepository.findOne({
      where: { id, userId },
      relations: ['aiConfig', 'repositories', 'repositories.repository', 'conversations']
    })

    if (!assistant) {
      throw new NotFoundException('助手不存在')
    }

    return assistant
  }

  async updateAssistant(
    id: string,
    userId: string,
    updateAssistantDto: UpdateAssistantDto
  ): Promise<UserAssistant> {
    const assistant = await this.findById(id, userId)

    // 检查新名称是否与其他助手冲突
    if (updateAssistantDto.name && updateAssistantDto.name !== assistant.name) {
      const existingName = await this.assistantRepository.findOne({
        where: { userId, name: updateAssistantDto.name }
      })
      if (existingName && existingName.id !== id) {
        throw new ConflictException('助手名称已存在')
      }
    }

    // 验证AI配置是否属于用户
    if (updateAssistantDto.aiConfigId) {
      const aiConfig = await this.aiConfigRepository.findOne({
        where: { id: updateAssistantDto.aiConfigId, userId }
      })
      if (!aiConfig) {
        throw new BadRequestException('AI配置不存在或不属于当前用户')
      }
    }

    Object.assign(assistant, updateAssistantDto)
    const updatedAssistant = await this.assistantRepository.save(assistant)


    return updatedAssistant
  }

  async addRepositoryToAssistant(
    assistantId: string,
    userId: string,
    repoDto: AssistantRepositoryDto
  ): Promise<AssistantRepository> {
    const assistant = await this.findById(assistantId, userId)

    // 验证仓库是否属于用户
    const userRepo = await this.userRepoRepository.findOne({
      where: { id: repoDto.repositoryId, userId }
    })
    if (!userRepo) {
      throw new BadRequestException('仓库不存在或不属于当前用户')
    }

    // 检查是否已经关联
    const existing = await this.assistantRepoRepository.findOne({
      where: { assistantId, repositoryId: repoDto.repositoryId }
    })
    if (existing) {
      throw new ConflictException('仓库已经关联到此助手')
    }

    const assistantRepo = this.assistantRepoRepository.create({
      assistantId,
      repositoryId: repoDto.repositoryId,
      syncBranch: repoDto.syncBranch,
      autoSync: repoDto.autoSync,
      syncStatus: 'syncing'
    })

    const savedAssistantRepo = await this.assistantRepoRepository.save(assistantRepo)


    this.logger.log(`Repository added to assistant: ${userRepo.name} -> ${assistant.name}`)
    return savedAssistantRepo
  }

  async removeRepositoryFromAssistant(
    assistantId: string,
    repositoryId: string,
    userId: string
  ): Promise<void> {
    const assistant = await this.findById(assistantId, userId)

    const assistantRepo = await this.assistantRepoRepository.findOne({
      where: { assistantId, repositoryId },
      relations: ['repository']
    })

    if (!assistantRepo) {
      throw new NotFoundException('仓库关联不存在')
    }

    await this.assistantRepoRepository.remove(assistantRepo)


    this.logger.log(`Repository removed from assistant: ${repositoryId} -> ${assistant.name}`)
  }

  async syncAssistantRepository(
    assistantId: string,
    repositoryId: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const assistant = await this.findById(assistantId, userId)

    const assistantRepo = await this.assistantRepoRepository.findOne({
      where: { assistantId, repositoryId },
      relations: ['repository']
    })

    if (!assistantRepo) {
      throw new NotFoundException('仓库关联不存在')
    }

    try {
      assistantRepo.syncStatus = 'syncing'
      assistantRepo.lastSyncAt = new Date()
      assistantRepo.syncError = null
      await this.assistantRepoRepository.save(assistantRepo)

      // TODO: 实现具体的工作区同步逻辑
      // 1. 创建/更新工作区
      // 2. 同步仓库内容
      // 3. 建立文件索引

      assistantRepo.syncStatus = 'success'
      await this.assistantRepoRepository.save(assistantRepo)


      return { success: true, message: '同步成功' }
    } catch (error) {
      assistantRepo.syncStatus = 'failed'
      assistantRepo.syncError = error.message
      await this.assistantRepoRepository.save(assistantRepo)


      return { success: false, message: error.message }
    }
  }

  async deleteAssistant(id: string, userId: string): Promise<void> {
    const assistant = await this.findById(id, userId)

    await this.assistantRepository.remove(assistant)


    this.logger.log(`Assistant deleted: ${assistant.name} (${id}) for user ${userId}`)
  }

  private async addRepositoriesToAssistant(
    assistantId: string,
    repositoryIds: string[],
    userId: string
  ): Promise<void> {
    for (const repositoryId of repositoryIds) {
      const assistantRepo = this.assistantRepoRepository.create({
        assistantId,
        repositoryId,
        syncBranch: 'main',
        autoSync: true,
        syncStatus: 'syncing'
      })
      await this.assistantRepoRepository.save(assistantRepo)
    }
  }

  async getUserAssistantStats(userId: string): Promise<{
    total: number
    byStatus: Record<string, number>
    totalRepositories: number
    totalConversations: number
  }> {
    const assistants = await this.assistantRepository.find({
      where: { userId },
      relations: ['repositories', 'conversations']
    })

    const total = assistants.length
    const byStatus = assistants.reduce(
      (acc, assistant) => {
        acc[assistant.status] = (acc[assistant.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const totalRepositories = assistants.reduce(
      (sum, assistant) => sum + assistant.repositories.length,
      0
    )
    const totalConversations = assistants.reduce(
      (sum, assistant) => sum + assistant.conversations.length,
      0
    )

    return { total, byStatus, totalRepositories, totalConversations }
  }
}
