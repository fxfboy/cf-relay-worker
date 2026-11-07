export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 921600; // 900 KB
export const MAX_MSG_PER_SEC = 20;
export const MAX_CONNECTIONS = 8;

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
