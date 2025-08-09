import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigEntity } from '../entities/config.entity'
import axios from 'axios'

@Injectable()
export class ClaudeService {
  constructor(
    @InjectRepository(ConfigEntity)
    private configRepository: Repository<ConfigEntity>
  ) {}

  async getConfig() {
    const baseUrl = await this.configRepository.findOne({ where: { key: 'claude_base_url' } })
    const authToken = await this.configRepository.findOne({ where: { key: 'claude_auth_token' } })
    
    return {
      baseUrl: baseUrl?.value || 'https://api.anthropic.com',
      authToken: authToken?.value || ''
    }
  }

  async saveConfig(config: { baseUrl: string; authToken: string }) {
    await this.configRepository.save([
      { key: 'claude_base_url', value: config.baseUrl },
      { key: 'claude_auth_token', value: config.authToken }
    ])
    
    return this.getConfig()
  }

  async testConnection(config: { baseUrl: string; authToken: string }) {
    try {
      const response = await axios.post(
        `${config.baseUrl}/v1/messages`,
        {
          model: 'claude-3-sonnet-20240229',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.authToken,
            'anthropic-version': '2023-06-01'
          }
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
          model: tool === 'claude' ? 'claude-3-5-sonnet-20241022' : 'claude-3-sonnet-20240229',
          max_tokens: 4000,
          messages: [{ role: 'user', content }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.authToken,
            'anthropic-version': '2023-06-01'
          }
        }
      )
      
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || error.message)
    }
  }
}