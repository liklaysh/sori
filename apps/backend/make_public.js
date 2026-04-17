import { S3Client, PutBucketPolicyCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: "http://127.0.0.1:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: "admin",
    secretAccessKey: "password",
  },
  forcePathStyle: true,
});

const BUCKET_NAME = "sori-media";

const policy = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "PublicRead",
      Effect: "Allow",
      Principal: "*",
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
    },
  ],
};

async function run() {
  try {
    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(policy),
    }));
    console.log("✅ Bucket is now public");
  } catch (err) {
    console.error("❌ Failed to set policy:", err);
  }
}

run();
