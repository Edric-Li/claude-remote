import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
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
  await app.listen(port)

  console.log(`🚀 Server is running on http://localhost:${port}`)
}

bootstrap().catch(console.error)
