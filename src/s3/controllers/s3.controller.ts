import { Controller, Get } from '@nestjs/common';
import { S3Service } from '../services/s3.service';

@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Get('mp4-files')
  async fetchMp4Files() {
    return this.s3Service.getMp4Files();
  }
}
