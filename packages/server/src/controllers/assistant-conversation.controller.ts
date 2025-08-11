import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common'
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard'
import { CurrentUser } from '../modules/auth/decorators/current-user.decorator'
import { AssistantConversationService } from '../services/assistant-conversation.service'
import { 
  CreateConversationDto, 
  UpdateConversationDto, 
  CreateMessageDto, 
  BatchCreateMessagesDto,
  ArchiveConversationDto 
} from '../dto/assistant-conversation.dto'
import { AssistantConversation } from '../entities/assistant-conversation.entity'
import { AssistantMessage } from '../entities/assistant-message.entity'
import { User } from '../entities/user.entity'

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class AssistantConversationController {
  constructor(private readonly conversationService: AssistantConversationService) {}

  @Post()
  async createConversation(
    @CurrentUser() user: User,
    @Body() createConversationDto: CreateConversationDto
  ): Promise<AssistantConversation> {
    return this.conversationService.createConversation(user.id, createConversationDto)
  }

  @Get()
  async findUserConversations(
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('assistantId') assistantId?: string,
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 20
  ): Promise<{ conversations: AssistantConversation[]; total: number }> {
    return this.conversationService.findUserConversations(user.id, status, assistantId, page, limit)
  }

  @Get('stats')
  async getUserConversationStats(
    @CurrentUser() user: User
  ): Promise<{
    total: number
    byStatus: Record<string, number>
    totalMessages: number
    byAssistant: Record<string, number>
  }> {
    return this.conversationService.getUserConversationStats(user.id)
  }

  @Get(':id')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<AssistantConversation> {
    return this.conversationService.findById(id, user.id)
  }

  @Put(':id')
  async updateConversation(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateConversationDto: UpdateConversationDto
  ): Promise<AssistantConversation> {
    return this.conversationService.updateConversation(id, user.id, updateConversationDto)
  }

  @Put(':id/archive')
  async archiveConversation(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() archiveDto: ArchiveConversationDto
  ): Promise<AssistantConversation> {
    return this.conversationService.archiveConversation(id, user.id, archiveDto)
  }

  @Get(':id/messages')
  async getConversationMessages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 50
  ): Promise<{ messages: AssistantMessage[]; total: number }> {
    return this.conversationService.getConversationMessages(conversationId, user.id, page, limit)
  }

  @Post(':id/messages')
  async createMessage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() createMessageDto: CreateMessageDto
  ): Promise<AssistantMessage> {
    return this.conversationService.createMessage(conversationId, user.id, createMessageDto)
  }

  @Post(':id/messages/batch')
  async batchCreateMessages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() batchDto: BatchCreateMessagesDto
  ): Promise<AssistantMessage[]> {
    return this.conversationService.batchCreateMessages(conversationId, user.id, batchDto)
  }

  @Delete(':id/messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMessage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string
  ): Promise<void> {
    await this.conversationService.deleteMessage(messageId, conversationId, user.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    await this.conversationService.deleteConversation(id, user.id)
  }
}