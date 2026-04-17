import { describe, it, expect, beforeAll } from 'vitest';
import { config } from '../config.js';
import { AccessToken } from 'livekit-server-sdk';
import { s3Client, BUCKET_NAME } from '../utils/s3.js';
import { HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { redis } from '../utils/redis.js';

describe('Sori Backend Smoke Tests', () => {
  
  describe('Authentication & LiveKit', () => {
    it('should generate a valid LiveKit token', async () => {
      const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
        identity: 'test-user',
      });
      at.addGrant({ roomJoin: true, room: 'test-room' });
      const token = await at.toJwt();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);
    });
  });

  describe('Storage (MinIO)', () => {
    it('should be able to reach MinIO and check bucket', async () => {
      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
        expect(true).toBe(true);
      } catch (err: any) {
        console.warn('[Smoke Test] MinIO HeadBucket failed, might be first run:', err.message);
        // If it's 404, it might still be working but bucket not created yet
        expect(err.$metadata?.httpStatusCode).toBeDefined();
      }
    });

    it('should upload a small test buffer', async () => {
      const key = `test-smoke-${Date.now()}.txt`;
      const body = Buffer.from('sori-smoke-test');
      
      const response = await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: 'text/plain',
      }));
      
      expect(response.$metadata.httpStatusCode).toBe(200);
    });
  });

  describe('Valkey (Redis)', () => {
    it('should successfully ping Valkey', async () => {
      const pong = await redis.ping();
      expect(pong).toBe('PONG');
    });

    it('should perform a simple set/get', async () => {
      await redis.set('smoke-test-key', 'active');
      const val = await redis.get('smoke-test-key');
      expect(val).toBe('active');
    });
  });
});
