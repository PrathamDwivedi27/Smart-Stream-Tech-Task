import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Processor('video-storage')
export class VideoProcessor extends WorkerHost {
  private readonly s3Client = new S3Client({
    region: 'ap-northeast-1',
    endpoint: 'https://s3.ap-northeast-1.wasabisys.com',
    credentials: {
      accessKeyId: process.env.WASABI_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY as string,
    },
  });

  async process(job: Job<{ fileUrl: string }>) {
    console.log('📹 Received job:', job.data);
    const { fileUrl } = job.data;

    const uploadDir = path.join(__dirname, '../../uploads');
    console.log('Upload Dir:', uploadDir);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const originalFilename = path.basename(fileUrl.split('?')[0]);
    const localFilePath = path.join(uploadDir, originalFilename);

    try {
      console.log(`⬇️ Downloading: ${fileUrl}`);
      await this.retry(() => this.downloadFile(fileUrl, localFilePath), 3);
      console.log(`✅ Downloaded: ${localFilePath}`);

      // Compress video
      const compressedFilePath = path.join(
        uploadDir,
        `${path.parse(originalFilename).name}-compressed.mp4`,
      );
      console.log(`🔄 Compressing: ${localFilePath}`);
      await this.retry(
        () => this.compressVideo(localFilePath, compressedFilePath),
        2,
      );
      console.log(`✅ Compression done: ${compressedFilePath}`);

      await this.uploadToWasabi(compressedFilePath, 'task-smart-stream');

      // Cleanup files
      fs.unlinkSync(localFilePath);
      fs.unlinkSync(compressedFilePath);
    } catch (error) {
      console.error('❌ Error:', error);
      if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
    }
  }

  // Upload to Wasabi S3
  private async uploadToWasabi(localFilePath: string, bucketName: string) {
    const fileStream = fs.createReadStream(localFilePath);
    const key = path.basename(localFilePath);

    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: fileStream,
      ContentType: 'video/mp4',
    };

    try {
      console.log(`📤 Uploading ${key} to Wasabi...`);
      await this.s3Client.send(new PutObjectCommand(uploadParams));
      console.log(`✅ Upload successful: ${key}`);
    } catch (error) {
      console.error('❌ Wasabi Upload Error:', error);
      throw error;
    }
  }

  // Retry Helper Function
  private async retry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        console.warn(
          `🔁 Retry ${attempt + 1}/${retries} due to:`,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          error.message,
        );
      }
    }
    throw new Error(
      'Retry function failed without throwing an error explicitly.',
    );
  }

  // Download Video
  private async downloadFile(url: string, outputPath: string): Promise<void> {
    const writer = fs.createWriteStream(outputPath);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000,
    });

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  private compressVideo(
    inputPath: string,
    outputPath: string,
    resolution: string = '1280x720',
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx265')
        .size(resolution)
        .outputOptions([
          '-vf',
          `fps=8,scale=${resolution}`,
          '-crf 40',
          '-preset ultrafast',
          '-an',
          '-threads 0',
          '-movflags +faststart',
        ])
        .on('end', () => {
          console.log(`✅ Compression complete: ${outputPath}`);
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ Compression error:', error);
          reject(error);
        })
        .save(outputPath);
    });
  }
}
