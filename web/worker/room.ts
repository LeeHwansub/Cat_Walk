import { DurableObject } from 'cloudflare:workers';
import { MAX_PLAYERS } from '../src/net/protocol';
import { RoomCore, type PeerRecord } from './roomCore';
import type { Env } from './index';

/** WebSocket 첨부: 접속 id와 인사한 뒤의 사람 정보 */
interface Attachment {
  id: string;
  info: PeerRecord | null;
}

/**
 * 방 하나 = Durable Object 하나 (이름 `맵#번호`, D-59).
 * WebSocket 휴면(Hibernation) API를 쓴다: 메시지가 없으면 잠들어 요금이 들지 않고, 사람 정보는 접속 첨부에 남아 깨어날 때 되살린다.
 * 클라이언트의 연결 유지용 "ping"은 깨우지 않고 "pong"으로 자동 응답한다.
 */
export class Room extends DurableObject<Env> {
  private readonly core: RoomCore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const attached = ctx.getWebSockets().map((ws) => ws.deserializeAttachment() as Attachment | null).filter((a): a is Attachment => !!a);
    this.core = new RoomCore(
      {
        send: (to, msg) => {
          for (const ws of ctx.getWebSockets(to)) {
            try {
              ws.send(JSON.stringify(msg));
            } catch {
              /* 이미 닫힌 접속 */
            }
          }
        },
        save: (id, info) => {
          for (const ws of ctx.getWebSockets(id)) ws.serializeAttachment({ id, info } satisfies Attachment);
        },
        now: () => Date.now(),
        room: () => ctx.id.name ?? '',
      },
      attached.flatMap((a) => (a.info ? [a.info] : [])),
    );
    for (const a of attached) if (!a.info) this.core.connect(a.id);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    // 정원이 차면 409: 앞단(index.ts)이 다음 방으로 보낸다
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS) return new Response('room full', { status: 409 });
    const { 0: client, 1: server } = new WebSocketPair();
    const id = crypto.randomUUID().slice(0, 8);
    this.ctx.acceptWebSocket(server, [id]);
    server.serializeAttachment({ id, info: null } satisfies Attachment);
    this.core.connect(id);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const a = ws.deserializeAttachment() as Attachment | null;
    if (a && typeof message === 'string') this.core.message(a.id, message);
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    this.drop(ws);
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {
      /* 이미 닫힘 */
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.drop(ws);
  }

  private drop(ws: WebSocket): void {
    const a = ws.deserializeAttachment() as Attachment | null;
    if (a) this.core.leave(a.id);
  }
}
