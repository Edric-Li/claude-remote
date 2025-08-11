import { Repository } from 'typeorm'

export function createMockRepository<T>(): Repository<T> {
  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn(),
    getCount: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
    execute: jest.fn(),
    delete: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  }

  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    save: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    merge: jest.fn(),
    preload: jest.fn(),
    query: jest.fn(),
    clear: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    findByIds: jest.fn(),
    findOneOrFail: jest.fn(),
    findOneByOrFail: jest.fn(),
    exists: jest.fn(),
    existsBy: jest.fn(),
    insert: jest.fn(),
    upsert: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    recover: jest.fn(),
    softRemove: jest.fn(),
  } as any
}

export const mockUser = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  passwordHash: 'hashed',
  createdAt: new Date(),
  updatedAt: new Date(),
}

export const mockAiConfig = {
  id: 'test-config-id',
  userId: 'test-user-id',
  name: 'Test Config',
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'test-key',
  isDefault: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

export const mockRepository = {
  id: 'test-repo-id',
  userId: 'test-user-id',
  name: 'Test Repo',
  url: 'https://github.com/test/repo',
  type: 'git' as const,
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
}

export const mockAssistant = {
  id: 'test-assistant-id',
  userId: 'test-user-id',
  name: 'Test Assistant',
  description: 'Test Description',
  avatar: '🤖',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
}

export const mockConversation = {
  id: 'test-conversation-id',
  assistantId: 'test-assistant-id',
  title: 'Test Conversation',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
}

export const mockMessage = {
  id: 'test-message-id',
  conversationId: 'test-conversation-id',
  role: 'user' as const,
  content: 'Test message',
  createdAt: new Date(),
}