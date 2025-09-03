import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'your-bucket-name';

export interface UploadedImage {
  key: string;
  url: string;
  size: number;
  mimetype: string;
}

export const uploadImageToS3 = async (
  file: Express.Multer.File,
  folder: string = 'products'
): Promise<UploadedImage> => {
  const key = `${folder}/${Date.now()}-${file.originalname}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read'
  });

  await s3Client.send(command);

  const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

  return {
    key,
    url,
    size: file.size,
    mimetype: file.mimetype
  };
};

export const deleteImageFromS3 = async (key: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });

  await s3Client.send(command);
};

export const generatePresignedUrl = async (
  key: string,
  operation: 'put' | 'get' = 'put',
  expiresIn: number = 3600
): Promise<string> => {
  const command = operation === 'put' 
    ? new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    : new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key });

  return await getSignedUrl(s3Client, command, { expiresIn });
};

export default s3Client;
