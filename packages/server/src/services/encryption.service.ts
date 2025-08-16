import { Injectable } from '@nestjs/common'
import * as crypto from 'crypto'

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc'
  private readonly key: Buffer

  constructor() {
    const encryptionKey = process.env.ENCRYPTION_KEY
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required')
    }
    
    // 使用scrypt生成固定长度的密钥
    this.key = crypto.scryptSync(encryptionKey, 'salt', 32)
  }

  /**
   * 加密文本，每次使用随机IV
   * @param text 要加密的明文
   * @returns 格式为 "iv:encrypted" 的加密字符串
   */
  encrypt(text: string): string {
    if (!text) {
      throw new Error('Text to encrypt cannot be empty')
    }

    try {
      // 每次生成随机IV
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv)
      
      let encrypted = cipher.update(text, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      // 返回格式：iv:encrypted
      return iv.toString('hex') + ':' + encrypted
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`)
    }
  }

  /**
   * 解密文本
   * @param encryptedText 格式为 "iv:encrypted" 的加密字符串
   * @returns 解密后的明文
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) {
      throw new Error('Encrypted text cannot be empty')
    }

    try {
      const [ivHex, encrypted] = encryptedText.split(':')
      
      if (!ivHex || !encrypted) {
        throw new Error('Invalid encrypted text format')
      }

      const iv = Buffer.from(ivHex, 'hex')
      
      if (iv.length !== 16) {
        throw new Error('Invalid IV length')
      }

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv)
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`)
    }
  }

  /**
   * 检查文本是否是使用旧的固定IV方式加密的
   * 这用于向后兼容性检查
   * @param encryptedText 加密的文本
   * @returns 是否是旧格式
   */
  isLegacyFormat(encryptedText: string): boolean {
    if (!encryptedText || !encryptedText.includes(':')) {
      return false
    }
    
    const [ivHex] = encryptedText.split(':')
    
    // 检查IV部分的长度，旧格式可能有特定模式
    // 这里假设旧格式的IV是固定的32个字符(16字节hex)
    return ivHex.length === 32
  }

  /**
   * 使用旧的固定IV方式解密（向后兼容）
   * 仅在需要迁移旧数据时使用
   * @param encryptedText 使用旧方式加密的文本
   * @param legacyIv 旧的固定IV
   * @returns 解密后的明文
   */
  decryptLegacy(encryptedText: string, legacyIv: Buffer): string {
    if (!encryptedText) {
      throw new Error('Encrypted text cannot be empty')
    }

    try {
      // 旧格式可能是 "iv:encrypted" 或只是 "encrypted"
      let encrypted = encryptedText
      if (encryptedText.includes(':')) {
        [, encrypted] = encryptedText.split(':')
      }

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, legacyIv)
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      throw new Error(`Legacy decryption failed: ${error.message}`)
    }
  }

  /**
   * 重新加密数据（从旧格式迁移到新格式）
   * @param encryptedText 旧格式的加密文本
   * @param legacyIv 旧的固定IV
   * @returns 使用新格式（随机IV）重新加密的文本
   */
  reencrypt(encryptedText: string, legacyIv: Buffer): string {
    // 先用旧方式解密
    const plaintext = this.decryptLegacy(encryptedText, legacyIv)
    
    // 再用新方式加密
    return this.encrypt(plaintext)
  }
}