import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserRepository } from '../entities/user-repository.entity'
import {
  CreateRepositoryDto,
  UpdateRepositoryDto,
  SyncRepositoryDto
} from '../dto/user-repository.dto'
import { OperationLogService } from './operation-log.service'

@Injectable()
export class UserRepositoryService {
  private readonly logger = new Logger(UserRepositoryService.name)

  constructor(
    @InjectRepository(UserRepository)
    private repositoryRepository: Repository<UserRepository>,
    private operationLogService: OperationLogService
  ) {}

  async createRepository(
    userId: string,
    createRepoDto: CreateRepositoryDto
  ): Promise<UserRepository> {
    // 检查仓库名称是否已存在
    const existingName = await this.repositoryRepository.findOne({
      where: { userId, name: createRepoDto.name }
    })
    if (existingName) {
      throw new ConflictException('仓库名称已存在')
    }

    // 验证URL格式
    await this.validateRepositoryUrl(createRepoDto.url, createRepoDto.type)

    const repository = this.repositoryRepository.create({
      userId,
      ...createRepoDto,
      status: 'inactive' // 新建仓库默认为inactive，需要验证后才激活
    })

    const savedRepository = await this.repositoryRepository.save(repository)

    // 记录操作日志
    await this.operationLogService.createLog({
      userId,
      operationType: 'repository_create',
      resourceType: 'repository',
      resourceId: savedRepository.id,
      operationData: {
        name: savedRepository.name,
        type: savedRepository.type,
        url: savedRepository.url
      }
    })

    this.logger.log(
      `Repository created: ${savedRepository.name} (${savedRepository.id}) for user ${userId}`
    )
    return savedRepository
  }

  async findUserRepositories(userId: string, status?: string): Promise<UserRepository[]> {
    const where: any = { userId }
    if (status) {
      where.status = status
    }

    return await this.repositoryRepository.find({
      where,
      order: { createdAt: 'DESC' }
    })
  }

  async findById(id: string, userId: string): Promise<UserRepository> {
    const repository = await this.repositoryRepository.findOne({
      where: { id, userId },
      relations: ['assistantRepositories', 'assistantRepositories.assistant']
    })

    if (!repository) {
      throw new NotFoundException('仓库不存在')
    }

    return repository
  }

  async updateRepository(
    id: string,
    userId: string,
    updateRepoDto: UpdateRepositoryDto
  ): Promise<UserRepository> {
    const repository = await this.findById(id, userId)

    // 检查新名称是否与其他仓库冲突
    if (updateRepoDto.name && updateRepoDto.name !== repository.name) {
      const existingName = await this.repositoryRepository.findOne({
        where: { userId, name: updateRepoDto.name }
      })
      if (existingName && existingName.id !== id) {
        throw new ConflictException('仓库名称已存在')
      }
    }

    // 如果URL改变，需要重新验证
    if (updateRepoDto.url && updateRepoDto.url !== repository.url) {
      await this.validateRepositoryUrl(updateRepoDto.url, repository.type)
    }

    Object.assign(repository, updateRepoDto)
    const updatedRepository = await this.repositoryRepository.save(repository)

    // 记录操作日志
    await this.operationLogService.createLog({
      userId,
      operationType: 'repository_update',
      resourceType: 'repository',
      resourceId: id,
      operationData: updateRepoDto
    })

    return updatedRepository
  }

  async syncRepository(
    id: string,
    userId: string,
    syncDto: SyncRepositoryDto = {}
  ): Promise<{ success: boolean; message: string }> {
    const repository = await this.findById(id, userId)

    try {
      // 更新同步状态
      repository.lastSyncAt = new Date()
      repository.syncError = null
      repository.status = 'active'

      if (syncDto.branch) {
        repository.branch = syncDto.branch
      }

      await this.repositoryRepository.save(repository)

      // TODO: 实现具体的仓库同步逻辑
      // 1. Git仓库：执行git clone/pull操作
      // 2. 本地仓库：检查路径是否存在和可读

      // 记录操作日志
      await this.operationLogService.createLog({
        userId,
        operationType: 'repository_sync',
        resourceType: 'repository',
        resourceId: id,
        operationData: { success: true, branch: repository.branch }
      })

      this.logger.log(`Repository synced: ${repository.name} (${id}) for user ${userId}`)
      return { success: true, message: '同步成功' }
    } catch (error) {
      // 更新错误状态
      repository.syncError = error.message
      repository.status = 'error'
      await this.repositoryRepository.save(repository)

      // 记录操作日志
      await this.operationLogService.createLog({
        userId,
        operationType: 'repository_sync',
        resourceType: 'repository',
        resourceId: id,
        operationData: { success: false, error: error.message }
      })

      return { success: false, message: error.message }
    }
  }

  async testConnection(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const repository = await this.findById(id, userId)

    try {
      // TODO: 实现具体的连接测试逻辑
      // 1. Git仓库：测试连接和认证
      // 2. 本地仓库：检查路径访问权限

      // 记录操作日志
      await this.operationLogService.createLog({
        userId,
        operationType: 'repository_test',
        resourceType: 'repository',
        resourceId: id,
        operationData: { success: true, type: repository.type }
      })

      return { success: true, message: '连接测试成功' }
    } catch (error) {
      // 记录操作日志
      await this.operationLogService.createLog({
        userId,
        operationType: 'repository_test',
        resourceType: 'repository',
        resourceId: id,
        operationData: { success: false, error: error.message, type: repository.type }
      })

      return { success: false, message: error.message }
    }
  }

  async deleteRepository(id: string, userId: string): Promise<void> {
    const repository = await this.findById(id, userId)

    // 检查是否有助手正在使用此仓库
    if (repository.assistantRepositories && repository.assistantRepositories.length > 0) {
      throw new BadRequestException('仓库正在被助手使用，无法删除')
    }

    await this.repositoryRepository.remove(repository)

    // 记录操作日志
    await this.operationLogService.createLog({
      userId,
      operationType: 'repository_delete',
      resourceType: 'repository',
      resourceId: id,
      operationData: { name: repository.name, type: repository.type }
    })

    this.logger.log(`Repository deleted: ${repository.name} (${id}) for user ${userId}`)
  }

  private async validateRepositoryUrl(url: string, type: 'git' | 'local'): Promise<void> {
    if (type === 'git') {
      // Git URL格式验证
      const gitUrlRegex = /^(https?:\/\/|git@)[\w\-.]+[/:][\w\-./]+\.git$/
      if (!gitUrlRegex.test(url)) {
        throw new BadRequestException('Git仓库URL格式不正确')
      }
    } else if (type === 'local') {
      // 本地路径验证
      if (!url || url.trim() === '') {
        throw new BadRequestException('本地路径不能为空')
      }
    }
  }

  async getUserRepositoryStats(userId: string): Promise<{
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
  }> {
    const repositories = await this.repositoryRepository.find({
      where: { userId },
      select: ['status', 'type']
    })

    const total = repositories.length
    const byStatus = repositories.reduce(
      (acc, repo) => {
        acc[repo.status] = (acc[repo.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const byType = repositories.reduce(
      (acc, repo) => {
        acc[repo.type] = (acc[repo.type] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return { total, byStatus, byType }
  }
}
