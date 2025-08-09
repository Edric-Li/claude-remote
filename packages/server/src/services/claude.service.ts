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
    const configs = await this.configRepository.find({
      where: [
        { key: 'claude_base_url' },
        { key: 'claude_auth_token' },
        { key: 'claude_model' },
        { key: 'claude_max_tokens' },
        { key: 'claude_temperature' },
        { key: 'claude_timeout' }
      ]
    })
    
    const configMap = configs.reduce((acc, config) => {
      acc[config.key] = config.value
      return acc
    }, {} as Record<string, string>)
    
    return {
      baseUrl: configMap['claude_base_url'] || 'https://api.anthropic.com',
      authToken: configMap['claude_auth_token'] || '',
      model: configMap['claude_model'] || 'claude-3-5-sonnet-20241022',
      maxTokens: parseInt(configMap['claude_max_tokens']) || 4000,
      temperature: parseFloat(configMap['claude_temperature']) || 0.7,
      timeout: parseInt(configMap['claude_timeout']) || 30000
    }
  }

  async saveConfig(config: { 
    baseUrl: string; 
    authToken: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  }) {
    const configsToSave = [
      { key: 'claude_base_url', value: config.baseUrl },
      { key: 'claude_auth_token', value: config.authToken }
    ]
    
    if (config.model !== undefined) {
      configsToSave.push({ key: 'claude_model', value: config.model })
    }
    if (config.maxTokens !== undefined) {
      configsToSave.push({ key: 'claude_max_tokens', value: config.maxTokens.toString() })
    }
    if (config.temperature !== undefined) {
      configsToSave.push({ key: 'claude_temperature', value: config.temperature.toString() })
    }
    if (config.timeout !== undefined) {
      configsToSave.push({ key: 'claude_timeout', value: config.timeout.toString() })
    }
    
    await this.configRepository.save(configsToSave)
    
    return this.getConfig()
  }

  async testConnection(config: { 
    baseUrl: string; 
    authToken: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }) {
    try {
      const response = await axios.post(
        `${config.baseUrl}/v1/messages`,
        {
          model: config.model || 'claude-3-5-sonnet-20241022',
          max_tokens: Math.min(config.maxTokens || 10, 100), // 测试时限制最大token数
          temperature: config.temperature || 0.7,
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
          model: tool === 'claude' ? (config.model || 'claude-3-5-sonnet-20241022') : 'claude-3-sonnet-20240229',
          max_tokens: config.maxTokens || 4000,
          temperature: config.temperature || 0.7,
          messages: [{ role: 'user', content }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.authToken,
            'anthropic-version': '2023-06-01'
          },
          timeout: config.timeout || 30000
        }
      )
      
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || error.message)
    }
  }
}