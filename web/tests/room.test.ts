import { describe, expect, it } from 'vitest';
import { RoomCore, type PeerRecord } from '../worker/roomCore';
import { MAX_PLAYERS, type ServerMessage } from '../src/net/protocol';
import { defaultAppearance } from '../src/cat/appearance';

const look = defaultAppearance();
const hello = (nick: string) => JSON.stringify({ t: 'hello', nick, look });
const st = (x: number) => JSON.stringify({ t: 's', x, z: 0, y: 0, h: 0, p: 0, b: 'walk', v: 0.5, g: 0 });

/** 메모리 방: 보낸 메시지를 사람별로 모은다 */
function setup() {
  let now = 0;
  const inbox = new Map<string, ServerMessage[]>();
  const saved = new Map<string, PeerRecord>();
  const room = new RoomCore({
    send: (to, m) => inbox.get(to)?.push(m),
    save: (id, rec) => void saved.set(id, rec),
    now: () => now,
  });
  const connect = (id: string) => {
    inbox.set(id, []);
    room.connect(id);
  };
  return { room, inbox, saved, connect, tick: (ms: number) => (now += ms) };
}

describe('방 (Durable Object 안의 로직)', () => {
  it('인사하면 지금 있는 사람 목록을 받고, 다른 사람들에게는 들어왔다고 알린다', () => {
    const { room, inbox, connect } = setup();
    connect('a');
    room.message('a', hello('A'));
    connect('b');
    room.message('b', hello('B'));
    const welcome = inbox.get('b')!.find((m) => m.t === 'welcome');
    expect(welcome && welcome.t === 'welcome' && welcome.peers.map((p) => p.nick)).toEqual(['A']);
    expect(inbox.get('a')!.some((m) => m.t === 'join' && m.peer.nick === 'B')).toBe(true);
  });

  it('인사 전에는 상태·채팅을 보내도 아무에게도 전달하지 않는다', () => {
    const { room, inbox, connect } = setup();
    connect('a');
    room.message('a', hello('A'));
    connect('b');
    room.message('b', st(1));
    room.message('b', JSON.stringify({ t: 'chat', text: 'hi' }));
    expect(inbox.get('a')!.filter((m) => m.t === 's' || m.t === 'chat')).toHaveLength(0);
  });

  it('상태는 보낸 사람을 뺀 모두에게, 보낸 사람 id를 붙여 전달하고 마지막 상태를 저장한다', () => {
    const { room, inbox, saved, connect } = setup();
    for (const id of ['a', 'b', 'c']) (connect(id), room.message(id, hello(id)));
    room.message('a', st(3));
    expect(inbox.get('a')!.some((m) => m.t === 's')).toBe(false);
    for (const id of ['b', 'c']) expect(inbox.get(id)!.some((m) => m.t === 's' && m.id === 'a' && m.s.x === 3)).toBe(true);
    expect(saved.get('a')?.s?.x).toBe(3);
  });

  it('채팅은 보낸 사람을 포함한 모두에게 닉네임과 함께', () => {
    const { room, inbox, connect } = setup();
    for (const id of ['a', 'b']) (connect(id), room.message(id, hello(id)));
    room.message('a', JSON.stringify({ t: 'chat', text: '야옹' }));
    for (const id of ['a', 'b']) expect(inbox.get(id)!.some((m) => m.t === 'chat' && m.text === '야옹' && m.nick === 'a')).toBe(true);
  });

  it('너무 자주 보내면 버린다: 채팅은 연속 3개까지, 상태는 1초에 15개까지', () => {
    const { room, inbox, connect, tick } = setup();
    for (const id of ['a', 'b']) (connect(id), room.message(id, hello(id)));
    for (let i = 0; i < 10; i++) room.message('a', JSON.stringify({ t: 'chat', text: `${i}` }));
    expect(inbox.get('b')!.filter((m) => m.t === 'chat')).toHaveLength(3);
    tick(2100);
    room.message('a', JSON.stringify({ t: 'chat', text: 'later' }));
    expect(inbox.get('b')!.filter((m) => m.t === 'chat')).toHaveLength(4);
    for (let i = 0; i < 40; i++) room.message('a', st(i));
    expect(inbox.get('b')!.filter((m) => m.t === 's').length).toBeLessThanOrEqual(15);
  });

  it('나가면 남은 사람들에게 알린다', () => {
    const { room, inbox, connect } = setup();
    for (const id of ['a', 'b']) (connect(id), room.message(id, hello(id)));
    room.leave('a');
    expect(inbox.get('b')!.some((m) => m.t === 'leave' && m.id === 'a')).toBe(true);
    expect(room.count).toBe(1);
  });

  it(`정원(${MAX_PLAYERS}명)이 차면 더 받지 않는다`, () => {
    const { room, connect } = setup();
    for (let i = 0; i < MAX_PLAYERS; i++) connect(`p${i}`);
    expect(room.isFull).toBe(true);
  });

  it('잠들었다 깨어나도(Durable Object 휴면) 저장된 사람 정보로 목록을 되살린다', () => {
    const { room, saved, connect } = setup();
    for (const id of ['a', 'b']) (connect(id), room.message(id, hello(id)));
    room.message('a', st(5));
    const inbox = new Map<string, ServerMessage[]>([['c', []]]);
    const woke = new RoomCore({ send: (to, m) => inbox.get(to)?.push(m), save: () => {}, now: () => 0 }, [...saved.values()]);
    woke.connect('c');
    woke.message('c', hello('C'));
    const w = inbox.get('c')!.find((m) => m.t === 'welcome');
    expect(w && w.t === 'welcome' && w.peers.map((p) => [p.nick, p.s?.x ?? null])).toEqual([
      ['a', 5],
      ['b', null],
    ]);
  });
});
