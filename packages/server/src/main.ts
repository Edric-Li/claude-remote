import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { WebSocketController } from './controllers/websocket.controller'
import { ChatGateway } from './chat/chat.gateway'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  // Enable CORS for web client
  app.enableCors({
    origin: true,
    credentials: true
  })

  const port = process.env.PORT || 3001
  
  // 启动HTTP服务器
  const server = await app.listen(port)

  // 获取 WebSocket 控制器和 ChatGateway 实例
  const webSocketController = app.get(WebSocketController)
  const chatGateway = app.get(ChatGateway)

  // 建立双向引用
  webSocketController.setChatGateway(chatGateway)
  webSocketController.initWebSocketServer(server)
  chatGateway.setWebSocketController(webSocketController)

  console.log(`🚀 Server is running on http://localhost:${port}`)
  console.log(`🔌 WebSocket server is running on ws://localhost:${port}/ws`)
}

bootstrap().catch(console.error)
