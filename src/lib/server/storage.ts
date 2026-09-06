import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getRequiredEnv } from "./env";

function localPath(key: string) {
  if (!/^[a-zA-Z0-9/_-]+\.pdf$/.test(key)) throw new Error("Invalid storage key");
  // Runtime data is mounted separately and must never enter the web build trace.
  const root = resolve(/* turbopackIgnore: true */ process.env.LOCAL_STORAGE_DIR || "uploads");
  const target = resolve(root, key);
  if (!target.startsWith(root + sep)) throw new Error("Storage path escaped root");
  return target;
}
function local() {
  if (process.env.STORAGE_DRIVER === "local") {
    if (process.env.NODE_ENV === "production") throw new Error("Production requires private S3 storage");
    return true;
  }
  return false;
}
let client: S3Client | undefined;
function s3() {
  return client ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: getRequiredEnv("S3_ACCESS_KEY"), secretAccessKey: getRequiredEnv("S3_SECRET_KEY") },
  });
}
export async function writeObject(key: string, bytes: Buffer): Promise<void> {
  if (local()) { const path = localPath(key); await mkdir(dirname(path), { recursive: true, mode: 0o700 }); await writeFile(path, bytes, { mode: 0o600, flag: "wx" }); return; }
  await s3().send(new PutObjectCommand({ Bucket: getRequiredEnv("S3_BUCKET"), Key: key, Body: bytes, ContentType: "application/pdf" }));
}
export async function readObject(key: string): Promise<Buffer> {
  if (local()) return readFile(/* turbopackIgnore: true */ localPath(key));
  const result = await s3().send(new GetObjectCommand({ Bucket: getRequiredEnv("S3_BUCKET"), Key: key }));
  if (!result.Body) throw new Error("Object is empty");
  return Buffer.from(await result.Body.transformToByteArray());
}
export async function deleteObject(key: string): Promise<void> {
  if (local()) { await unlink(localPath(key)).catch(error => { if (error.code !== "ENOENT") throw error; }); return; }
  await s3().send(new DeleteObjectCommand({ Bucket: getRequiredEnv("S3_BUCKET"), Key: key }));
}
