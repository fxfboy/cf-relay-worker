import { isValidRoutingId } from "./rid";
import { Room } from "./room";

export { Room };

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/ws") {
      return new Response("not found", { status: 404 });
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const rid = url.searchParams.get("rid");
    if (!isValidRoutingId(rid)) {
      return new Response("bad rid", { status: 400 });
    }
    const stub = env.ROOM.get(env.ROOM.idFromName(rid));
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;
