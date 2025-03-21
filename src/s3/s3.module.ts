import { Module } from '@nestjs/common';
import { S3Controller } from './controllers/s3.controller';
import { S3Service } from './services/s3.service';

@Module({
  controllers: [S3Controller],
  providers: [S3Service],
})
export class S3Module {}
