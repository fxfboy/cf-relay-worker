export const PROTOCOL_VERSION = 1;
/**
 * Durable Objects 收到的 WebSocket 消息上限：32 MiB。
 * https://developers.cloudflare.com/durable-objects/platform/limits/
 * 文档更新于 2026-11-07，该上限只约束收到的消息。
 */
export const CF_RECEIVED_WS_MESSAGE_BYTES = 32 * 1024 * 1024;
/** 未设置或非法的 MAX_MESSAGE_BYTES 时使用，与平台入站上限相同。 */
export const DEFAULT_MAX_MESSAGE_BYTES = CF_RECEIVED_WS_MESSAGE_BYTES;
export const MAX_MSG_PER_SEC = 20;
export const MAX_CONNECTIONS = 8;

/**
 * 解析单条文本帧的字节上限。
 * `MAX_MESSAGE_BYTES` 为十进制整数字符串时采用该值；空、非整数、小于 1 则回退默认值。
 * 大于平台入站上限的配置会被钳到 {@link CF_RECEIVED_WS_MESSAGE_BYTES}，更大的帧到不了 Durable Object。
 */
export function resolveMaxMessageBytes(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_MAX_MESSAGE_BYTES;
  const trimmed = raw.trim();
  if (!/^[0-9]+$/.test(trimmed)) return DEFAULT_MAX_MESSAGE_BYTES;
  const n = BigInt(trimmed);
  if (n < 1n) return DEFAULT_MAX_MESSAGE_BYTES;
  const cap = BigInt(CF_RECEIVED_WS_MESSAGE_BYTES);
  if (n > cap) return CF_RECEIVED_WS_MESSAGE_BYTES;
  return Number(n);
}

export function atCapacity(count: number): boolean {
  return count >= MAX_CONNECTIONS;
}

export type ControlCode = "too_large" | "rate_limited" | "bad_request";

const encoder = new TextEncoder();

export function byteLength(s: string): number {
  return encoder.encode(s).length;
}

export function controlError(code: ControlCode, detail?: string): string {
  const msg: { control: "error"; code: ControlCode; detail?: string } = { control: "error", code };
  if (detail !== undefined) msg.detail = detail;
  return JSON.stringify(msg);
}
