import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common'
import { UserService } from './user.service'
import { OperationLogService } from './operation-log.service'
import { User } from '../entities/user.entity'
import { mockUser, createMockRepository } from '../test/test-utils'
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, UpdateUserStatusDto } from '../dto/user.dto'

describe('UserService', () => {
  let service: UserService
  let userRepository: jest.Mocked<Repository<User>>
  let operationLogService: jest.Mocked<OperationLogService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
        {
          provide: OperationLogService,
          useValue: {
            createLog: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile()

    service = module.get<UserService>(UserService)
    userRepository = module.get(getRepositoryToken(User))
    operationLogService = module.get(OperationLogService)
  })

  describe('createUser', () => {
    const createUserDto: CreateUserDto = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
    }

    it('should create a user successfully', async () => {
      userRepository.findOne.mockResolvedValue(null)
      userRepository.create.mockReturnValue(mockUser as User)
      userRepository.save.mockResolvedValue(mockUser as User)

      const result = await service.createUser(createUserDto)

      expect(userRepository.findOne).toHaveBeenCalledTimes(2) // 检查用户名和邮箱
      expect(userRepository.create).toHaveBeenCalledWith({
        username: createUserDto.username,
        email: createUserDto.email,
        passwordHash: createUserDto.password,
        displayName: createUserDto.displayName,
        avatarUrl: createUserDto.avatarUrl,
        status: 'active',
      })
      expect(userRepository.save).toHaveBeenCalledWith(mockUser)
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result).toEqual(mockUser)
    })

    it('should throw ConflictException if username exists', async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser as User)

      await expect(service.createUser(createUserDto))
        .rejects.toThrow(ConflictException)

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { username: createUserDto.username }
      })
    })

    it('should throw ConflictException if email exists', async () => {
      userRepository.findOne
        .mockResolvedValueOnce(null) // username check
        .mockResolvedValueOnce(mockUser as User) // email check

      await expect(service.createUser(createUserDto))
        .rejects.toThrow(ConflictException)
    })

    it('should create user without email', async () => {
      const dtoWithoutEmail = { ...createUserDto, email: undefined }
      userRepository.findOne.mockResolvedValue(null)
      userRepository.create.mockReturnValue(mockUser as User)
      userRepository.save.mockResolvedValue(mockUser as User)

      const result = await service.createUser(dtoWithoutEmail)

      expect(userRepository.findOne).toHaveBeenCalledTimes(1) // 只检查用户名
      expect(result).toEqual(mockUser)
    })
  })

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const users = [mockUser as User]
      userRepository.findAndCount.mockResolvedValue([users, 1])

      const result = await service.findAll(1, 20)

      expect(userRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        order: { createdAt: 'DESC' }
      })
      expect(result).toEqual({ users, total: 1 })
    })

    it('should handle pagination correctly', async () => {
      await service.findAll(3, 10)

      expect(userRepository.findAndCount).toHaveBeenCalledWith({
        skip: 20,
        take: 10,
        order: { createdAt: 'DESC' }
      })
    })
  })

  describe('findById', () => {
    it('should return user by id', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User)

      const result = await service.findById('user-1')

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        relations: ['aiConfigs', 'repositories', 'assistants']
      })
      expect(result).toEqual(mockUser)
    })

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null)

      await expect(service.findById('user-1'))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('findByUsername', () => {
    it('should return user by username', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User)

      const result = await service.findByUsername('testuser')

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
        select: ['id', 'username', 'email', 'passwordHash', 'displayName', 'avatarUrl', 'status', 'createdAt', 'updatedAt', 'lastLoginAt']
      })
      expect(result).toEqual(mockUser)
    })

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null)

      await expect(service.findByUsername('testuser'))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('updateUser', () => {
    const updateUserDto: UpdateUserDto = {
      displayName: 'Updated User',
      email: 'updated@example.com',
    }

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateUserDto }
      userRepository.findOne
        .mockResolvedValueOnce(mockUser as User) // findById call
        .mockResolvedValueOnce(null) // email uniqueness check
      userRepository.save.mockResolvedValue(updatedUser as User)

      const result = await service.updateUser('user-1', updateUserDto)

      expect(userRepository.save).toHaveBeenCalledWith({
        ...mockUser,
        ...updateUserDto
      })
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result).toEqual(updatedUser)
    })

    it('should throw ConflictException if email is taken by another user', async () => {
      const anotherUser = { ...mockUser, id: 'user-2' }
      userRepository.findOne
        .mockResolvedValueOnce(mockUser as User) // findById call
        .mockResolvedValueOnce(anotherUser as User) // email check

      await expect(service.updateUser('user-1', updateUserDto))
        .rejects.toThrow(ConflictException)
    })

    it('should allow updating to same email', async () => {
      const updateWithSameEmail = { ...updateUserDto, email: mockUser.email }
      userRepository.findOne.mockResolvedValue(mockUser as User)
      userRepository.save.mockResolvedValue(mockUser as User)

      const result = await service.updateUser('user-1', updateWithSameEmail)

      expect(result).toEqual(mockUser)
    })
  })

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      currentPassword: 'oldPassword',
      newPassword: 'newPassword',
    }

    it('should change password successfully', async () => {
      const userWithPassword = { ...mockUser, validatePassword: jest.fn().mockResolvedValue(true) }
      userRepository.findOne.mockResolvedValue(userWithPassword as User)
      userRepository.save.mockResolvedValue(userWithPassword as User)

      await service.changePassword('user-1', changePasswordDto)

      expect(userWithPassword.validatePassword).toHaveBeenCalledWith('oldPassword')
      expect(userRepository.save).toHaveBeenCalledWith({
        ...userWithPassword,
        passwordHash: 'newPassword'
      })
      expect(operationLogService.createLog).toHaveBeenCalled()
    })

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null)

      await expect(service.changePassword('user-1', changePasswordDto))
        .rejects.toThrow(NotFoundException)
    })

    it('should throw BadRequestException if current password is invalid', async () => {
      const userWithPassword = { ...mockUser, validatePassword: jest.fn().mockResolvedValue(false) }
      userRepository.findOne.mockResolvedValue(userWithPassword as User)

      await expect(service.changePassword('user-1', changePasswordDto))
        .rejects.toThrow(BadRequestException)
    })
  })

  describe('updateStatus', () => {
    const updateStatusDto: UpdateUserStatusDto = { status: 'inactive' }

    it('should update user status successfully', async () => {
      const updatedUser = { ...mockUser, status: 'inactive' }
      userRepository.findOne.mockResolvedValue(mockUser as User)
      userRepository.save.mockResolvedValue(updatedUser as User)

      const result = await service.updateStatus('user-1', updateStatusDto)

      expect(userRepository.save).toHaveBeenCalledWith(updatedUser)
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result).toEqual(updatedUser)
    })
  })

  describe('updateLastLogin', () => {
    it('should update last login time', async () => {
      await service.updateLastLogin('user-1', '192.168.1.1')

      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        lastLoginAt: expect.any(Date)
      })
    })

    it('should work without IP address', async () => {
      await service.updateLastLogin('user-1')

      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        lastLoginAt: expect.any(Date)
      })
    })
  })

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User)
      userRepository.remove.mockResolvedValue(mockUser as User)

      await service.deleteUser('user-1')

      expect(userRepository.remove).toHaveBeenCalledWith(mockUser)
      expect(operationLogService.createLog).toHaveBeenCalled()
    })
  })

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      userRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80)  // active
        .mockResolvedValueOnce(15)  // inactive
        .mockResolvedValueOnce(5)   // banned

      const result = await service.getUserStats()

      expect(result).toEqual({
        total: 100,
        active: 80,
        inactive: 15,
        banned: 5,
      })
    })
  })
})