import { MAX_PLAYERS, parseClientMessage, type CatState, type PeerInfo, type ServerMessage } from '../src/net/protocol';

/** 접속 한 개에 붙여 저장하는 정보 (Durable Object가 잠들어도 WebSocket 첨부로 남는다, 2KB 이하) */
export type PeerRecord = PeerInfo;

export interface RoomIO {
  /** id인 사람에게 보낸다 */
  send(to: string, msg: ServerMessage): void;
  /** 사람 정보를 접속에 붙여 저장한다 (휴면 후 되살리기용) */
  save(id: string, rec: PeerRecord): void;
  /** 밀리초 */
  now(): number;
  /** 방 이름 (welcome에 실어 보낸다) */
  room?(): string;
}

/** 토큰 통: capacity개까지 몰아서, 이후 perSec개씩 */
class Bucket {
  private tokens: number;
  private at: number;
  constructor(
    private readonly capacity: number,
    private readonly perSec: number,
    now: number,
  ) {
    this.tokens = capacity;
    this.at = now;
  }
  take(now: number): boolean {
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.at) / 1000) * this.perSec);
    this.at = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

interface Peer {
  info: PeerInfo | null;
  state: Bucket;
  chat: Bucket;
}

/**
 * 방 하나의 로직 (Cloudflare와 무관한 순수 코드라 테스트한다, worker/room.ts가 감싼다).
 * - 인사(hello)한 사람만 다른 사람에게 보인다. 상태는 보낸 사람 빼고, 채팅은 모두에게
 * - 너무 자주 보내면 버린다: 상태 1초 15개, 채팅 연속 3개 이후 2초에 1개
 * - 저장하지 않는다 (마지막 상태는 접속 첨부에만, 나가면 사라짐)
 */
export class RoomCore {
  private readonly peers = new Map<string, Peer>();

  constructor(
    private readonly io: RoomIO,
    restored: PeerRecord[] = [],
  ) {
    for (const rec of restored) this.peers.set(rec.id, this.newPeer(rec));
  }

  get count(): number {
    return this.peers.size;
  }

  get isFull(): boolean {
    return this.peers.size >= MAX_PLAYERS;
  }

  connect(id: string): void {
    this.peers.set(id, this.newPeer(null));
  }

  leave(id: string): void {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    if (p.info) this.broadcast({ t: 'leave', id }, null);
  }

  message(id: string, raw: unknown): void {
    const p = this.peers.get(id);
    const m = parseClientMessage(raw);
    if (!p || !m) return;
    const now = this.io.now();
    if (m.t === 'hello') {
      if (p.info) return; // 인사는 한 번
      p.info = { id, nick: m.nick, look: m.look, s: null };
      this.io.save(id, p.info);
      const others = [...this.peers.values()].flatMap((o) => (o.info && o.info.id !== id ? [o.info] : []));
      this.io.send(id, { t: 'welcome', id, room: this.io.room?.() ?? '', peers: others });
      this.broadcast({ t: 'join', peer: p.info }, id);
      return;
    }
    if (!p.info) return;
    if (m.t === 's') {
      if (!p.state.take(now)) return;
      p.info.s = m.s;
      this.io.save(id, p.info);
      this.broadcast({ t: 's', id, s: m.s }, id);
      return;
    }
    if (!p.chat.take(now)) return;
    this.broadcast({ t: 'chat', id, nick: p.info.nick, text: m.text }, null);
  }

  /** 마지막 상태 (테스트·점검용) */
  stateOf(id: string): CatState | null {
    return this.peers.get(id)?.info?.s ?? null;
  }

  private newPeer(info: PeerInfo | null): Peer {
    const now = this.io.now();
    return { info, state: new Bucket(15, 15, now), chat: new Bucket(3, 0.5, now) };
  }

  /** except: 빼고 보낼 사람 (null이면 모두) */
  private broadcast(msg: ServerMessage, except: string | null): void {
    for (const [id, p] of this.peers) if (p.info && id !== except) this.io.send(id, msg);
  }
}
