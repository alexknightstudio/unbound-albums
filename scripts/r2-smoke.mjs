/**
 * R2 smoke test — run after pasting the R2 credentials into .env.local:
 *   node scripts/r2-smoke.mjs
 *
 * Round-trips a small object: multipart create/abort, put, presigned GET
 * (fetched anonymously, like a gallery visitor would), delete. Prints PASS
 * per step; exits non-zero on any failure. No real gallery data touched.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AbortMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(repoRoot, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const missing = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].filter(
  (k) => !env[k],
);
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")} (uncomment and fill the R2_ lines)`);
  process.exit(1);
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});
const Bucket = env.R2_BUCKET;
const key = `smoke/unbound-smoke-${Math.random().toString(36).slice(2)}.txt`;
const body = `unbound galleries smoke ${new Date().toISOString()}`;

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}: ${error.message}`);
    process.exitCode = 1;
    throw error;
  }
};

try {
  await step("multipart create + abort", async () => {
    const { UploadId } = await r2.send(
      new CreateMultipartUploadCommand({ Bucket, Key: key, ContentType: "text/plain" }),
    );
    await r2.send(new AbortMultipartUploadCommand({ Bucket, Key: key, UploadId }));
  });

  await step("put object", () =>
    r2.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: "text/plain" })),
  );

  await step("presigned GET fetches anonymously", async () => {
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket, Key: key }), {
      expiresIn: 120,
    });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text !== body) throw new Error("content mismatch");
  });

  await step("unsigned GET is refused", async () => {
    const res = await fetch(
      `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${Bucket}/${key}`,
    );
    if (res.ok) throw new Error("bucket is publicly readable — lock it down");
  });

  await step("delete object", () => r2.send(new DeleteObjectCommand({ Bucket, Key: key })));

  console.log("\nR2 is wired correctly. The uploader and galleries are live.");
} catch {
  console.error("\nSmoke test failed — check the credentials and bucket name.");
}
