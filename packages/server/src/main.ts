import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  
  // Enable CORS for web client
  app.enableCors({
    origin: true,
    credentials: true
  })
  
  const port = process.env.PORT || 3000
  await app.listen(port)
  
  console.log(`🚀 Server is running on http://localhost:${port}`)
}

bootstrap().catch(console.error)