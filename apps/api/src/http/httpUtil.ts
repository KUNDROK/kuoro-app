import type { IncomingMessage, ServerResponse } from "node:http";

export type JsonBody = Record<string, unknown>;

export const MAX_BODY_BYTES = 20 * 1024 * 1024; // 20MB — supports base64-encoded document uploads

export function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

export function makeHttpError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export async function readJson(request: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.byteLength;

    if (totalBytes > MAX_BODY_BYTES) {
      throw makeHttpError("Request body too large", 413);
    }

    chunks.push(buf);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonBody;
  } catch {
    throw makeHttpError("Invalid JSON body", 400);
  }
}

export function getBearerToken(request: IncomingMessage) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}
