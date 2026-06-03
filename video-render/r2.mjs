// Cloudflare R2 上传（S3 兼容 PutObject，AWS SigV4 自签，无第三方依赖）。
//
// 渲染 worker 出片后，可选地把 MP4 传到 R2，返回可分享 URL。缺凭证时返回 null（优雅降级，
// 仍走「直接下载 MP4」老路）。
//
// 环境变量：
//   R2_ACCOUNT_ID         Cloudflare 账号 ID（拼默认 endpoint 用）
//   R2_ACCESS_KEY_ID      R2 API 令牌的 Access Key ID
//   R2_SECRET_ACCESS_KEY  R2 API 令牌的 Secret Access Key
//   R2_BUCKET             目标 bucket 名
//   R2_ENDPOINT           可选，默认 https://<account>.r2.cloudflarestorage.com
//   R2_PUBLIC_BASE        可选，公开访问域名（如 https://pub-xxx.r2.dev 或自定义域）。
//                         配了它返回的 url 才是公网可播放的；没配则返回 S3 endpoint URL（需自行签名访问）。

import { createHash, createHmac } from "node:crypto";

export function r2ConfigFromEnv(env = process.env) {
  const accountId = String(env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = String(env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = String(env.R2_BUCKET || "").trim();
  if (!accessKeyId || !secretAccessKey || !bucket) return null;
  const endpointRaw = String(env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")).trim();
  if (!endpointRaw) return null;
  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: endpointRaw.replace(/\/+$/, ""),
    publicBase: String(env.R2_PUBLIC_BASE || "").trim().replace(/\/+$/, ""),
  };
}

const sha256hex = (b) => createHash("sha256").update(b).digest("hex");
const hmac = (key, str) => createHmac("sha256", key).update(str, "utf8").digest();

// 按段 encode key（保留 "/" 分隔，段内转义），与 canonicalUri 一致。
function encodeKey(key) {
  return String(key)
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

// 把 MP4（或任意 buffer）以 SigV4 PutObject 传到 R2。成功返回 { url, key, public }，
// 未配置返回 null。失败抛错（调用方决定是否降级）。
export async function uploadToR2(buf, key, contentType = "application/octet-stream", cfg = r2ConfigFromEnv()) {
  if (!cfg) return null;
  const region = "auto";
  const service = "s3";
  const host = new URL(cfg.endpoint).host;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20260602T203000Z
  const dateStamp = amzDate.slice(0, 8);

  const canonicalUri = `/${cfg.bucket}/${encodeKey(key)}`;
  const payloadHash = sha256hex(buf);
  // host / x-amz-content-sha256 / x-amz-date 参与签名（按字典序）。
  const canonicalHeaders =
    `host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "", // 无 query
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256hex(canonicalRequest),
  ].join("\n");

  let signingKey = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  signingKey = hmac(signingKey, region);
  signingKey = hmac(signingKey, service);
  signingKey = hmac(signingKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const endpointUrl = `${cfg.endpoint}${canonicalUri}`;
  // 注意：host / content-length 是 fetch 的禁止头，由 undici 按 URL 自动填，不手动传，
  // 否则与签名不一致。content-type 不参与签名，可随意带。
  const resp = await fetch(endpointUrl, {
    method: "PUT",
    headers: {
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "content-type": contentType,
      authorization,
    },
    body: buf,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`R2 上传失败 ${resp.status}: ${text.slice(0, 200)}`);
  }
  const publicUrl = cfg.publicBase ? `${cfg.publicBase}/${encodeKey(key)}` : endpointUrl;
  return { url: publicUrl, key, public: Boolean(cfg.publicBase) };
}
