import type { Env } from "./env";
import { extractRoomOffer } from "./connect";
import { Room } from "./room";

export type { Env };
export { Room };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("method not allowed", { status: 405 });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname !== "/ws") {
      return new Response("not found", { status: 404 });
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }

    const offer = extractRoomOffer(request);
    if (!offer.rid) {
      return new Response("bad rid", { status: 400 });
    }

    const stub = env.ROOM.get(env.ROOM.idFromName(offer.rid));
    const res = await stub.fetch(request);
    if (res.status === 101 && offer.acceptProtocol) {
      const headers = new Headers(res.headers);
      headers.set("Sec-WebSocket-Protocol", offer.acceptProtocol);
      return new Response(null, { status: 101, webSocket: res.webSocket, headers });
    }
    return res;
  },
} satisfies ExportedHandler<Env>;
