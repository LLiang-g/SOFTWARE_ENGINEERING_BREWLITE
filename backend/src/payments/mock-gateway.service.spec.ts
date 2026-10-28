import { Test, TestingModule } from '@nestjs/testing';
import { MockGatewayService } from './mock-gateway.service';

describe('MockGatewayService', () => {
  let service: MockGatewayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockGatewayService],
    }).compile();

    service = module.get<MockGatewayService>(MockGatewayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
