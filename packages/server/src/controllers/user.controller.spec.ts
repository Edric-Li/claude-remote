import { Test, TestingModule } from '@nestjs/testing'
import { UserController } from './user.controller'
import { UserService } from '../services/user.service'
import { mockUser } from '../test/test-utils'
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, UpdateUserStatusDto } from '../dto/user.dto'
import { User } from '../entities/user.entity'

describe('UserController', () => {
  let controller: UserController
  let userService: jest.Mocked<UserService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            createUser: jest.fn(),
            findAll: jest.fn(),
            getUserStats: jest.fn(),
            findById: jest.fn(),
            updateUser: jest.fn(),
            changePassword: jest.fn(),
            updateStatus: jest.fn(),
            deleteUser: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<UserController>(UserController)
    userService = module.get(UserService)
  })

  describe('createUser', () => {
    it('should create a user', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
      }
      const mockRequest = { ip: '192.168.1.1' } as any

      userService.createUser.mockResolvedValue(mockUser as User)

      const result = await controller.createUser(createUserDto, mockRequest)

      expect(userService.createUser).toHaveBeenCalledWith(createUserDto)
      expect(result).toEqual(mockUser)
    })
  })

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const mockResult = { users: [mockUser as User], total: 1 }
      userService.findAll.mockResolvedValue(mockResult)

      const result = await controller.findAll(1, 20)

      expect(userService.findAll).toHaveBeenCalledWith(1, 20)
      expect(result).toEqual(mockResult)
    })

    it('should use default pagination values', async () => {
      const mockResult = { users: [mockUser as User], total: 1 }
      userService.findAll.mockResolvedValue(mockResult)

      await controller.findAll()

      expect(userService.findAll).toHaveBeenCalledWith(1, 20)
    })
  })

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const mockStats = { total: 100, active: 80, inactive: 15, banned: 5 }
      userService.getUserStats.mockResolvedValue(mockStats)

      const result = await controller.getUserStats()

      expect(userService.getUserStats).toHaveBeenCalled()
      expect(result).toEqual(mockStats)
    })
  })

  describe('getCurrentUser', () => {
    it('should return current user details', async () => {
      userService.findById.mockResolvedValue(mockUser as User)

      const result = await controller.getCurrentUser(mockUser as User)

      expect(userService.findById).toHaveBeenCalledWith(mockUser.id)
      expect(result).toEqual(mockUser)
    })
  })

  describe('findById', () => {
    it('should return user by id', async () => {
      userService.findById.mockResolvedValue(mockUser as User)

      const result = await controller.findById('user-1')

      expect(userService.findById).toHaveBeenCalledWith('user-1')
      expect(result).toEqual(mockUser)
    })
  })

  describe('updateCurrentUser', () => {
    it('should update current user', async () => {
      const updateUserDto: UpdateUserDto = { displayName: 'Updated User' }
      const updatedUser = { ...mockUser, displayName: 'Updated User' }
      userService.updateUser.mockResolvedValue(updatedUser as User)

      const result = await controller.updateCurrentUser(mockUser as User, updateUserDto)

      expect(userService.updateUser).toHaveBeenCalledWith(mockUser.id, updateUserDto, mockUser.id)
      expect(result).toEqual(updatedUser)
    })
  })

  describe('updateUser', () => {
    it('should update user by id', async () => {
      const updateUserDto: UpdateUserDto = { displayName: 'Updated User' }
      const updatedUser = { ...mockUser, displayName: 'Updated User' }
      const currentUser = { id: 'current-user-id' } as User
      userService.updateUser.mockResolvedValue(updatedUser as User)

      const result = await controller.updateUser('user-1', updateUserDto, currentUser)

      expect(userService.updateUser).toHaveBeenCalledWith('user-1', updateUserDto, 'current-user-id')
      expect(result).toEqual(updatedUser)
    })
  })

  describe('changePassword', () => {
    it('should change user password', async () => {
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'oldPassword',
        newPassword: 'newPassword',
      }
      userService.changePassword.mockResolvedValue(undefined)

      await controller.changePassword(mockUser as User, changePasswordDto)

      expect(userService.changePassword).toHaveBeenCalledWith(
        mockUser.id,
        changePasswordDto,
        mockUser.id
      )
    })
  })

  describe('updateUserStatus', () => {
    it('should update user status', async () => {
      const updateStatusDto: UpdateUserStatusDto = { status: 'inactive' }
      const updatedUser = { ...mockUser, status: 'inactive' }
      const currentUser = { id: 'current-user-id' } as User
      userService.updateStatus.mockResolvedValue(updatedUser as User)

      const result = await controller.updateUserStatus('user-1', updateStatusDto, currentUser)

      expect(userService.updateStatus).toHaveBeenCalledWith('user-1', updateStatusDto, 'current-user-id')
      expect(result).toEqual(updatedUser)
    })
  })

  describe('deleteUser', () => {
    it('should delete user', async () => {
      const currentUser = { id: 'current-user-id' } as User
      userService.deleteUser.mockResolvedValue(undefined)

      await controller.deleteUser('user-1', currentUser)

      expect(userService.deleteUser).toHaveBeenCalledWith('user-1', 'current-user-id')
    })
  })
})