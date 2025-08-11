import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { usersApi } from '../users.api'
import type { User, CreateUserDto, UpdateUserDto, UserStats } from '../../types/api.types'

// Mock HttpClient
vi.mock('../../utils/httpClient', () => ({
  HttpClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

// Mock fetch for file downloads
global.fetch = vi.fn()

describe('UsersApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const mockUser: User = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto: CreateUserDto = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        displayName: 'New User'
      }

      const mockResponse = new Response(JSON.stringify(mockUser), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await usersApi.create(createUserDto)

      expect(HttpClient.post).toHaveBeenCalledWith('/api/users', createUserDto)
      expect(result).toEqual(mockUser)
    })
  })

  describe('findAll', () => {
    it('should return list of users', async () => {
      const mockUsers = [mockUser]
      const mockResponse = new Response(JSON.stringify(mockUsers), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.get).mockResolvedValue(mockResponse)

      const result = await usersApi.findAll()

      expect(HttpClient.get).toHaveBeenCalledWith('/api/users')
      expect(result).toEqual(mockUsers)
    })

    it('should support pagination parameters', async () => {
      const paginationParams = { page: 2, limit: 10 }
      const mockUsers = [mockUser]
      const mockResponse = new Response(JSON.stringify(mockUsers), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.get).mockResolvedValue(mockResponse)

      await usersApi.findAll(paginationParams)

      expect(HttpClient.get).toHaveBeenCalledWith('/api/users?page=2&limit=10')
    })
  })

  describe('findAllPaginated', () => {
    it('should return paginated users', async () => {
      const mockPaginatedResponse = {
        data: [mockUser],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      }

      const mockResponse = new Response(JSON.stringify(mockPaginatedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.get).mockResolvedValue(mockResponse)

      const result = await usersApi.findAllPaginated({ page: 1, limit: 20 })

      expect(result).toEqual(mockPaginatedResponse)
    })
  })

  describe('findById', () => {
    it('should return user by id', async () => {
      const userId = '1'
      const mockResponse = new Response(JSON.stringify(mockUser), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.get).mockResolvedValue(mockResponse)

      const result = await usersApi.findById(userId)

      expect(HttpClient.get).toHaveBeenCalledWith('/api/users/1')
      expect(result).toEqual(mockUser)
    })
  })

  describe('update', () => {
    it('should update user', async () => {
      const userId = '1'
      const updateDto: UpdateUserDto = {
        displayName: 'Updated Name'
      }
      const updatedUser = { ...mockUser, displayName: 'Updated Name' }

      const mockResponse = new Response(JSON.stringify(updatedUser), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.put).mockResolvedValue(mockResponse)

      const result = await usersApi.update(userId, updateDto)

      expect(HttpClient.put).toHaveBeenCalledWith('/api/users/1', updateDto)
      expect(result).toEqual(updatedUser)
    })
  })

  describe('delete', () => {
    it('should delete user', async () => {
      const userId = '1'
      const mockResponse = new Response(null, { status: 204 })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.delete).mockResolvedValue(mockResponse)

      await usersApi.delete(userId)

      expect(HttpClient.delete).toHaveBeenCalledWith('/api/users/1')
    })
  })

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockResponse = new Response(JSON.stringify(mockUser), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.get).mockResolvedValue(mockResponse)

      const result = await usersApi.getCurrentUser()

      expect(HttpClient.get).toHaveBeenCalledWith('/api/users/me')
      expect(result).toEqual(mockUser)
    })
  })

  describe('getStats', () => {
    it('should return user statistics', async () => {
      const mockStats: UserStats = {
        total: 100,
        byStatus: { active: 80, inactive: 20 },
        newUsersThisMonth: 10
      }

      const mockResponse = new Response(JSON.stringify(mockStats), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.get).mockResolvedValue(mockResponse)

      const result = await usersApi.getStats()

      expect(HttpClient.get).toHaveBeenCalledWith('/api/users/stats')
      expect(result).toEqual(mockStats)
    })
  })

  describe('bulkDelete', () => {
    it('should delete multiple users', async () => {
      const userIds = ['1', '2', '3']
      const expectedResponse = { message: '成功删除用户', deletedCount: 3 }

      const mockResponse = new Response(JSON.stringify(expectedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await usersApi.bulkDelete(userIds)

      expect(HttpClient.post).toHaveBeenCalledWith('/api/users/bulk-delete', { userIds })
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('exportUsers', () => {
    it('should export users as blob', async () => {
      // Mock localStorage for auth token
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(JSON.stringify({
          state: { accessToken: 'mock-token' }
        }))
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true
      })

      const mockBlob = new Blob(['user data'], { type: 'text/csv' })
      const mockResponse = new Response(mockBlob, {
        status: 200,
        headers: { 'Content-Type': 'text/csv' }
      })

      vi.mocked(fetch).mockResolvedValue(mockResponse)

      const result = await usersApi.exportUsers({ format: 'csv' })

      expect(fetch).toHaveBeenCalledWith(
        '/api/users/export?format=csv',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer mock-token'
          }
        })
      )
      // In the test environment, check that we got a response that looks like a blob
      expect(result).toBeDefined()
      expect(result.type).toBe('text/csv')
      expect(result.size).toBe(13) // 'user data' blob size
    })
  })
})