import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Post } from '@nestjs/common';
import { Queue } from 'bullmq';
import { S3Service } from 'src/s3/services/s3.service';
import { BullBoardInstance, InjectBullBoard } from '@bull-board/nestjs';

@Controller('video')
export class VideoController {
  constructor(
    @InjectQueue('video-storage') private videoQueue: Queue,
    @InjectBullBoard() private readonly boardInstance: BullBoardInstance,
    private readonly s3Service: S3Service,
  ) {}

  @Post('process')
  async processMp4Files() {
    const mp4Files: string[] = await this.s3Service.getMp4Files();
    // console.log('MP4 files:', mp4Files);

    if (mp4Files.length === 0) {
      return { message: 'No MP4 files found in S3.' };
    }

    const jobs = mp4Files.map((fileUrl, index) => {
      return this.videoQueue.add(
        'process-video',
        { fileUrl },
        { jobId: `video-${index}` },
      );
    });
    await Promise.all(jobs);

    return {
      message: `Added ${mp4Files.length} MP4 files to the queue.`,
    };
  }
}
