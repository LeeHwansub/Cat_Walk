import type { CatAppearance } from '../cat/appearance';
import { ROOM_PATH, type CatState, type ServerMessage } from './protocol';

/** 브라우저 WebSocket 중 쓰는 부분 (테스트에서 가짜로 바꾼다) */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
}

export type NetStatus = 'off' | 'connecting' | 'online';

const OPEN = 1;
const PING_EVERY = 30_000;
const RETRY_MAX = 30_000;

/**
 * 멀티플레이 접속 (D-59): 맵의 방에 들어가고, 끊기면 1·2·4…초(최대 30초) 뒤 다시 들어간다.
 * 30초마다 "ping"을 보낸다. 서버는 Durable Object를 깨우지 않고 "pong"으로 답한다 (요금이 들지 않는다)
 */
export class NetClient {
  onMessage: (m: ServerMessage) => void = () => {};
  onStatus: (s: NetStatus) => void = () => {};

  private ws: SocketLike | null = null;
  private target: { mapId: string; hello: { nick: string; look: CatAppearance } } | null = null;
  private retryMs = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  /** base: 사이트 주소 (http(s)://…, 끝 / 없이) */
  constructor(
    private readonly base: string,
    private readonly makeSocket: (url: string) => SocketLike = (u) => new WebSocket(u) as unknown as SocketLike,
  ) {}

  /** 이 맵의 방에 들어간다 (다른 방에 있었으면 나와서) */
  join(mapId: string, hello: { nick: string; look: CatAppearance }): void {
    this.leave();
    this.target = { mapId, hello };
    this.retryMs = 1000;
    this.open();
  }

  /** 나간다 (다시 접속하지 않는다) */
  leave(): void {
    this.target = null;
    this.clearTimers();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      ws.close();
    }
    this.onStatus('off');
  }

  get online(): boolean {
    return this.ws?.readyState === OPEN;
  }

  /** 보내는 모양은 상태 값을 펼친 것: {t:'s', x, z, …} (서버 parseClientMessage) */
  sendState(s: CatState): void {
    this.send({ t: 's', ...s });
  }

  sendChat(text: string): void {
    this.send({ t: 'chat', text });
  }

  private send(m: Record<string, unknown>): void {
    if (this.ws?.readyState !== OPEN) return;
    this.ws.send(JSON.stringify(m));
  }

  private open(): void {
    if (!this.target) return;
    const { mapId, hello } = this.target;
    const url = `${this.base.replace(/^http/, 'ws')}${ROOM_PATH}?map=${encodeURIComponent(mapId)}`;
    this.onStatus('connecting');
    let ws: SocketLike;
    try {
      ws = this.makeSocket(url);
    } catch {
      this.retry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retryMs = 1000;
      ws.send(JSON.stringify({ t: 'hello', nick: hello.nick, look: hello.look }));
      this.onStatus('online');
      this.pingTimer = setInterval(() => ws.readyState === OPEN && ws.send('ping'), PING_EVERY);
    };
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string' || e.data === 'pong') return;
      try {
        this.onMessage(JSON.parse(e.data) as ServerMessage);
      } catch {
        /* 이상한 메시지는 무시 */
      }
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.clearTimers();
      this.retry();
    };
  }

  private retry(): void {
    if (!this.target) return;
    this.onStatus('connecting');
    this.retryTimer = setTimeout(() => this.open(), this.retryMs);
    this.retryMs = Math.min(RETRY_MAX, this.retryMs * 2);
  }

  private clearTimers(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.retryTimer = null;
    this.pingTimer = null;
  }
}
