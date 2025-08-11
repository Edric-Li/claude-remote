/**
 * WebSocket 模块
 * 集成 WebSocket 控制器和相关服务
 */

import { Module, forwardRef } from '@nestjs/common'
import { WebSocketController } from './controllers/websocket.controller'
import { ChatModule } from './chat/chat.module'
import { JwtModule } from '@nestjs/jwt'

@Module({
  imports: [
    forwardRef(() => ChatModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ai-orchestra-secret',
      signOptions: { expiresIn: '7d' }
    })
  ],
  controllers: [WebSocketController],
  providers: [WebSocketController],
  exports: [WebSocketController]
})
export class WebSocketModule {}