const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const config = require("../config");

/**
 * S3Service - Handles all S3 operations
 * Single Responsibility: Manage S3 interactions
 */

const s3Client = new S3Client({ region: config.S3_REGION });

/**
 * Convert readable stream to string
 * @param {Stream} stream - Stream to convert
 * @returns {Promise<string|null>} - String content or null
 */
async function streamToString(stream) {
  if (!stream) return null;
  return await new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

/**
 * Get text content from S3
 * @param {string} key - S3 object key
 * @returns {Promise<string|null>} - Content or null if not found
 */
async function getText(key) {
  try {
    const out = await s3Client.send(
      new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key })
    );
    return await streamToString(out.Body);
  } catch (err) {
    return null;
  }
}

/**
 * Put text content to S3
 * @param {string} key - S3 object key
 * @param {string} text - Content to store
 */
async function putText(key, text) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      Body: text,
      ContentType: "text/plain; charset=utf-8",
    })
  );
}

/**
 * Delete object from S3
 * @param {string} key - S3 object key
 */
async function deleteObject(key) {
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key })
    );
  } catch (e) {
    console.error("s3Delete error:", e);
  }
}

/**
 * List objects in S3 with prefix
 * @param {string} prefix - S3 prefix to search
 * @returns {Promise<Array>} - Array of objects with Key, LastModified, Size
 */
async function list(prefix) {
  try {
    const out = await s3Client.send(
      new ListObjectsV2Command({ Bucket: config.S3_BUCKET, Prefix: prefix })
    );
    return (out.Contents || []).map((c) => ({
      Key: c.Key,
      LastModified: c.LastModified,
      Size: c.Size,
    }));
  } catch (e) {
    console.error("s3List error:", e);
    return [];
  }
}

module.exports = {
  getText,
  putText,
  deleteObject,
  list,
};
