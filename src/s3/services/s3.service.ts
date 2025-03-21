import { Injectable } from '@nestjs/common';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class S3Service {
  private s3: S3Client;
  private bucketName = process.env.AWS_BUCKET_NAME;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async getMp4Files(): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
      });

      const response = await this.s3.send(command);

      if (!response.Contents) return [];

      // Generate Signed URLs
      const mp4Files | [] = await Promise.all(
        response.Contents.filter((file) => file.Key && file.Key.endsWith('.mp4'))
          .map(async (file) => {
            if (!file.Key) {
              throw new Error('File key is undefined');
            }
            const url = await getSignedUrl(
              this.s3,
              new GetObjectCommand({ Bucket: this.bucketName, Key: file.Key }),
            //   { expiresIn: 3600 } // URL valid for 1 hour
            );
          return url;
        }),
      );

      console.log('MP4 Signed URLs:', mp4Files);
      return mp4Files;
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  }
}
