import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 — the gallery file store (HOSTING_SPEC.md §3).
 *
 * R2 speaks the S3 API; zero egress is the whole business model, so delivery
 * must stay on Cloudflare's pipe. RLS does not guard these objects — every
 * URL that leaves the server is short-TTL presigned, and ONLY issued after
 * an access check (photographer session, or gallery slug + password cookie).
 * Server-only module: never import from client components.
 */

const REQUIRED = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

export function r2Configured(): boolean {
  return REQUIRED.every((k) => !!process.env[k]);
}

function required(name: (typeof REQUIRED)[number]): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Unbound Galleries needs the R2 credentials in .env.local — see the Cloudflare checklist in DECISIONS.md.`,
    );
  }
  return value;
}

let client: S3Client | null = null;

function r2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

const bucket = () => required("R2_BUCKET");

/** Object key scheme. Everything under a gallery's prefix so per-gallery
 * lifecycle (archive, export, delete-on-request) is a prefix operation. */
export const galleryKeys = {
  original: (galleryId: string, photoId: string, ext: string) =>
    `g/${galleryId}/o/${photoId}.${ext}`,
  thumb: (galleryId: string, photoId: string) =>
    `g/${galleryId}/t/${photoId}.jpg`,
};

/** Short-TTL presigned GET. 15 minutes default — long enough for a browsing
 * session's image loads, short enough that a leaked URL goes stale fast. */
export function signedGetUrl(key: string, ttlSeconds = 15 * 60) {
  return getSignedUrl(
    r2(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: ttlSeconds },
  );
}

export async function createMultipartUpload(key: string, contentType: string) {
  const result = await r2().send(
    new CreateMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
    }),
  );
  if (!result.UploadId) throw new Error("R2 returned no UploadId");
  return result.UploadId;
}

/** Presigned URL for one part — the browser PUTs directly to R2, so upload
 * bandwidth never transits our servers. */
export function signedPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  ttlSeconds = 60 * 60,
) {
  return getSignedUrl(
    r2(),
    new UploadPartCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: ttlSeconds },
  );
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ PartNumber: number; ETag: string }>,
) {
  await r2().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts].sort((a, b) => a.PartNumber - b.PartNumber),
      },
    }),
  );
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  await r2().send(
    new AbortMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
    }),
  );
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function getObjectBytes(key: string): Promise<Buffer> {
  const result = await r2().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty body for ${key}`);
  return Buffer.from(bytes);
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteObject(key: string) {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
