import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { authApi } from '../auth.api'
import type { LoginDto, RegisterDto, AuthResponse } from '../../types/api.types'

// Mock HttpClient
vi.mock('../../utils/httpClient', () => ({
  HttpClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn()
  }
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

describe('AuthApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginDto: LoginDto = {
        username: 'testuser',
        password: 'password123'
      }

      const expectedResponse: AuthResponse = {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          displayName: 'Test User',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      }

      const mockResponse = new Response(JSON.stringify(expectedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await authApi.login(loginDto)

      expect(HttpClient.post).toHaveBeenCalledWith('/api/auth/login', loginDto)
      expect(result).toEqual(expectedResponse)
    })

    it('should throw ApiError for invalid credentials', async () => {
      const loginDto: LoginDto = {
        username: 'invalid',
        password: 'wrong'
      }

      const errorResponse = {
        statusCode: 401,
        message: 'Invalid credentials',
        error: 'Unauthorized',
        timestamp: '2024-01-01T00:00:00Z',
        path: '/api/auth/login'
      }

      const mockResponse = new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      await expect(authApi.login(loginDto)).rejects.toThrowError('Invalid credentials')
    })
  })

  describe('register', () => {
    it('should successfully register new user', async () => {
      const registerDto: RegisterDto = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        displayName: 'New User'
      }

      const expectedResponse: AuthResponse = {
        user: {
          id: '2',
          username: 'newuser',
          email: 'newuser@example.com',
          displayName: 'New User',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      }

      const mockResponse = new Response(JSON.stringify(expectedResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await authApi.register(registerDto)

      expect(HttpClient.post).toHaveBeenCalledWith('/api/auth/register', registerDto)
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('getCurrentUser', () => {
    it('should return current user info', async () => {
      const expectedUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
        status: 'active' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      const mockResponse = new Response(JSON.stringify(expectedUser), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.get).mockResolvedValue(mockResponse)

      const result = await authApi.getCurrentUser()

      expect(HttpClient.get).toHaveBeenCalledWith('/api/auth/me')
      expect(result).toEqual(expectedUser)
    })
  })

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const expectedResponse: AuthResponse = {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          displayName: 'Test User',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      }

      const mockResponse = new Response(JSON.stringify(expectedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await authApi.refreshToken()

      expect(HttpClient.post).toHaveBeenCalledWith('/api/auth/refresh', undefined)
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      const changePasswordDto = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      }

      const expectedResponse = { message: '密码修改成功' }

      const mockResponse = new Response(JSON.stringify(expectedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.put).mockResolvedValue(mockResponse)

      const result = await authApi.changePassword(changePasswordDto)

      expect(HttpClient.put).toHaveBeenCalledWith('/api/auth/change-password', changePasswordDto)
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('validateEmail', () => {
    it('should validate email format', async () => {
      const email = 'test@example.com'
      const expectedResponse = { valid: true }

      const mockResponse = new Response(JSON.stringify(expectedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await authApi.validateEmail(email)

      expect(HttpClient.post).toHaveBeenCalledWith('/api/auth/validate-email', { email })
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('checkUsername', () => {
    it('should check username availability', async () => {
      const username = 'newuser'
      const expectedResponse = { available: true }

      const mockResponse = new Response(JSON.stringify(expectedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await authApi.checkUsername(username)

      expect(HttpClient.post).toHaveBeenCalledWith('/api/auth/check-username', { username })
      expect(result).toEqual(expectedResponse)
    })
  })
})
