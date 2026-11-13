import { isValidRoutingId } from "./rid";
import { RID_PROTOCOL_PREFIX, ROOM_HEADER, SUBPROTOCOL } from "./protocol";

export type RoomOffer = {
  /** Valid 64-hex routing id, or null if missing/invalid. */
  rid: string | null;
  /** Subprotocol to echo on 101, or null when the client offered none. */
  acceptProtocol: string | null;
};

export function parseProtocols(header: string | null): string[] {
  if (!header) return [];
  return header.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Pick a room id from the upgrade request. Prefer Sec-WebSocket-Protocol
 * tokens (`cf-relay-v1`, `rid.<64hex>`); fall back to X-Relay-Room for
 * non-browser clients. Query-string `rid` is intentionally ignored.
 *
 * Never log the returned values: they identify the room.
 */
export function extractRoomOffer(request: Request): RoomOffer {
  const protocols = parseProtocols(request.headers.get("Sec-WebSocket-Protocol"));

  let protoRid: string | null = null;
  let protoRidMalformed = false;
  for (const p of protocols) {
    if (!p.startsWith(RID_PROTOCOL_PREFIX)) continue;
    const candidate = p.slice(RID_PROTOCOL_PREFIX.length);
    if (isValidRoutingId(candidate)) {
      protoRid = candidate;
      break;
    }
    protoRidMalformed = true;
  }

  // A malformed rid.* token is a hard failure; do not fall back to the header.
  if (protoRidMalformed && protoRid === null) {
    return { rid: null, acceptProtocol: null };
  }

  let rid = protoRid;
  if (rid === null) {
    const headerRid = request.headers.get(ROOM_HEADER);
    if (isValidRoutingId(headerRid)) rid = headerRid;
  }

  let acceptProtocol: string | null = null;
  if (protocols.includes(SUBPROTOCOL)) {
    // Echo only the version token so the rid is not repeated on the response.
    acceptProtocol = SUBPROTOCOL;
  } else if (protoRid !== null) {
    // Client offered only rid.<hex>; RFC 6455 requires we select from the offer.
    acceptProtocol = RID_PROTOCOL_PREFIX + protoRid;
  }

  return { rid, acceptProtocol };
}
