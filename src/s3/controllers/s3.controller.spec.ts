import { Test, TestingModule } from '@nestjs/testing';
import { S3Controller } from './s3.controller';

describe('S3Service', () => {
  let service: S3Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [S3Controller],
    }).compile();

    service = module.get<S3Controller>(S3Controller);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
