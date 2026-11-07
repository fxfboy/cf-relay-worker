const RID_RE = /^[0-9a-f]{64}$/;

export function isValidRoutingId(rid: string | null): rid is string {
  return rid !== null && RID_RE.test(rid);
}
