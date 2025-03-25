import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { VideoController } from './controller/video.controller';
import { VideoProcessor } from './workers/video.worker';
import { S3Module } from 'src/s3/s3.module';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Module({
  imports: [
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    BullModule.registerQueue({
      name: 'video-storage',
    }),
    BullBoardModule.forFeature({
      name: 'video-storage',
      adapter: BullMQAdapter, //or use BullAdapter if you're using bull instead of bullMQ
    }),
    S3Module,
  ],
  controllers: [VideoController],
  providers: [VideoProcessor],
})
export class BullModules {}
