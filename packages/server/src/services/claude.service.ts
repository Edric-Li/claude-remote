import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ClaudeConfig } from '../entities/claude-config.entity'
import axios from 'axios'

@Injectable()
export class ClaudeService {
  constructor(
    @InjectRepository(ClaudeConfig)
    private claudeConfigRepository: Repository<ClaudeConfig>
  ) {}

  async getConfig() {
    // 获取当前激活的全局配置
    const config = await this.claudeConfigRepository.findOne({
      where: { 
        isActive: true
      },
      order: { updatedAt: 'DESC' }
    })
    
    if (!config) {
      // 返回默认配置
      return {
        baseUrl: 'https://api.anthropic.com',
        authToken: ''
      }
    }
    
    return {
      baseUrl: config.baseUrl,
      authToken: config.authToken
    }
  }

  async saveConfig(config: { 
    baseUrl: string; 
    authToken: string;
  }) {
    // 先将之前的配置设为非激活
    await this.claudeConfigRepository.update(
      { isActive: true },
      { isActive: false }
    )
    
    // 创建新配置
    const newConfig = this.claudeConfigRepository.create({
      baseUrl: config.baseUrl,
      authToken: config.authToken,
      isActive: true
    })
    
    await this.claudeConfigRepository.save(newConfig)
    
    return this.getConfig()
  }

  async testConnection(config: { 
    baseUrl: string; 
    authToken: string;
  }) {
    try {
      const response = await axios.post(
        `${config.baseUrl}/v1/messages`,
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10, // 测试时使用最小token数
          messages: [{ role: 'user', content: 'Hi' }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.authToken,
            'anthropic-version': '2023-06-01'
          },
          timeout: 10000 // 测试连接时使用较短的超时时间
        }
      )
      
      return { success: true, data: response.data }
    } catch (error: any) {
      return { 
        success: false, 
        error: error.response?.data?.error?.message || error.message 
      }
    }
  }

  async sendMessage(content: string, tool: 'claude' | 'qwcoder') {
    const config = await this.getConfig()
    
    if (!config.authToken) {
      throw new Error('Claude API token not configured')
    }

    try {
      const response = await axios.post(
        `${config.baseUrl}/v1/messages`,
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.authToken,
            'anthropic-version': '2023-06-01'
          },
          timeout: 30000
        }
      )
      
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || error.message)
    }
  }
}