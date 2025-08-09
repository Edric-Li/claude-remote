import { Controller, Get } from '@nestjs/common'
import { TestService } from '../services/test.service'

@Controller('api/test')
export class TestController {
  constructor(
    private readonly testService: TestService
  ) {
    console.log('TestController constructor, testService:', this.testService)
  }

  @Get()
  test(): string {
    console.log('TestController.test() called, testService:', this.testService)
    return this.testService?.getHello() || 'Service is undefined'
  }
}