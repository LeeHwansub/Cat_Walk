import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetClient, type SocketLike } from '../src/net/client';
import { defaultAppearance } from '../src/cat/appearance';

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(m: unknown) {
    this.onmessage?.({ data: typeof m === 'string' ? m : JSON.stringify(m) });
  }
}

const hello = { nick: '뽀리', look: defaultAppearance() };
const make = () => new NetClient('wss://cat.example', (u) => new FakeSocket(u));

describe('멀티플레이 접속 (브라우저 WebSocket)', () => {
  beforeEach(() => {
    FakeSocket.all = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('맵 id로 방 주소에 접속하고, 열리면 인사(닉네임·외형)를 보낸다', () => {
    const c = make();
    c.join('neighborhood', hello);
    const ws = FakeSocket.all[0];
    expect(ws.url).toBe('wss://cat.example/api/room?map=neighborhood');
    ws.open();
    expect(JSON.parse(ws.sent[0])).toMatchObject({ t: 'hello', nick: '뽀리' });
  });

  it('받은 메시지를 알려 주고, 이상한 메시지는 무시한다', () => {
    const c = make();
    const got: string[] = [];
    c.onMessage = (m) => got.push(m.t);
    c.join('neighborhood', hello);
    FakeSocket.all[0].open();
    FakeSocket.all[0].receive({ t: 'welcome', id: 'a', room: 'neighborhood#1', peers: [] });
    FakeSocket.all[0].receive('pong');
    FakeSocket.all[0].receive('{bad');
    expect(got).toEqual(['welcome']);
  });

  it('끊기면 1초, 2초, 4초 … 뒤 다시 접속한다 (최대 30초)', () => {
    const c = make();
    c.join('neighborhood', hello);
    FakeSocket.all[0].close();
    vi.advanceTimersByTime(999);
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(FakeSocket.all).toHaveLength(2);
    FakeSocket.all[1].close();
    vi.advanceTimersByTime(2001);
    expect(FakeSocket.all).toHaveLength(3);
  });

  it('직접 나가면(leave) 다시 접속하지 않는다', () => {
    const c = make();
    c.join('neighborhood', hello);
    c.leave();
    vi.advanceTimersByTime(60000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('30초마다 ping을 보내 접속을 유지한다 (서버는 깨지 않고 pong으로 답한다)', () => {
    const c = make();
    c.join('neighborhood', hello);
    FakeSocket.all[0].open();
    vi.advanceTimersByTime(30001);
    expect(FakeSocket.all[0].sent).toContain('ping');
  });

  it('열리기 전에는 상태·채팅을 보내지 않는다', () => {
    const c = make();
    c.join('neighborhood', hello);
    c.sendState({ x: 0, z: 0, y: 0, h: 0, p: 0, b: 'idle', v: 0, g: 0 });
    c.sendChat('hi');
    expect(FakeSocket.all[0].sent).toHaveLength(0);
  });
});
