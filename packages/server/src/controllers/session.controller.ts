import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request
} from '@nestjs/common'
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard'
import { SessionService } from '../services/session.service'

@Controller('api/sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * 创建新会话
   */
  @Post()
  async create(
    @Request() req,
    @Body()
    body: {
      name: string
      repositoryId: string
      aiTool: string
      metadata?: any
    }
  ) {
    return await this.sessionService.create(req.user.id, body)
  }

  /**
   * 获取当前用户的所有会话
   */
  @Get()
  async findAll(@Request() req) {
    return await this.sessionService.findAllByUser(req.user.id)
  }

  /**
   * 获取会话详情
   */
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return await this.sessionService.findOne(id, req.user.id)
  }

  /**
   * 更新会话
   */
  @Put(':id')
  async update(@Request() req, @Param('id') id: string, @Body() body: any) {
    return await this.sessionService.update(id, req.user.id, body)
  }

  /**
   * 分配Worker
   */
  @Post(':id/assign-worker')
  async assignWorker(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { workerId: string; agentId: string }
  ) {
    return await this.sessionService.assignWorker(id, req.user.id, body.workerId, body.agentId)
  }

  /**
   * 添加消息
   */
  @Post(':id/messages')
  async addMessage(
    @Request() req,
    @Param('id') id: string,
    @Body()
    body: {
      from: 'user' | 'assistant' | 'system'
      content: string
      metadata?: any
    }
  ) {
    return await this.sessionService.addMessage(id, req.user.id, body)
  }

  /**
   * 获取会话消息
   */
  @Get(':id/messages')
  async getMessages(
    @Request() req,
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ) {
    return await this.sessionService.getMessages(id, req.user.id, limit || 100, offset || 0)
  }

  /**
   * 删除会话
   */
  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    return await this.sessionService.delete(id, req.user.id)
  }

  /**
   * 归档会话
   */
  @Post(':id/archive')
  async archive(@Request() req, @Param('id') id: string) {
    return await this.sessionService.archive(id, req.user.id)
  }

  /**
   * 获取统计信息
   */
  @Get('stats/overview')
  async getStats(@Request() req) {
    return await this.sessionService.getStats(req.user.id)
  }
}
