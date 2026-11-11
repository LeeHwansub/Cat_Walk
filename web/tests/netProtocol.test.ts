import { describe, expect, it } from 'vitest';
import { cleanChat, cleanNick, MAX_RAW, parseClientMessage, roomName } from '../src/net/protocol';
import { defaultAppearance } from '../src/cat/appearance';

const look = defaultAppearance();
const state = { x: 1.5, z: -2, y: 0, h: 1.2, p: 0, b: 'walk', v: 0.5, g: 0.3 };

describe('멀티플레이 메시지 검사 (서버가 받는 모든 값을 검사한다)', () => {
  it('인사: 닉네임과 외형을 받는다. 외형의 이상한 값은 기본값으로 바로잡는다', () => {
    const m = parseClientMessage(JSON.stringify({ t: 'hello', nick: ' 뽀리 ', look: { ...look, furColor: 'red;', size: 99 } }));
    expect(m?.t).toBe('hello');
    if (m?.t !== 'hello') return;
    expect(m.nick).toBe('뽀리');
    expect(m.look.furColor).toBe(look.furColor);
    expect(m.look.size).toBeLessThanOrEqual(1.2);
  });

  it('상태: 숫자는 유한하고 범위 안이어야 하며, 행동은 아는 이름만', () => {
    expect(parseClientMessage(JSON.stringify({ t: 's', ...state }))).toEqual({ t: 's', s: state });
    expect(parseClientMessage(JSON.stringify({ t: 's', ...state, x: 1e9 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 's', ...state, x: 'a' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 's', ...state, b: 'fly' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 's', ...state, b: '__proto__' }))).toBeNull();
  });

  it('채팅: 앞뒤 공백·제어 문자를 지우고 100자까지, 빈 채팅은 버린다', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'chat', text: '  안녕\u0000하세요 ' }))).toEqual({ t: 'chat', text: '안녕하세요' });
    expect(parseClientMessage(JSON.stringify({ t: 'chat', text: '   ' }))).toBeNull();
    expect(cleanChat('가'.repeat(300))).toHaveLength(100);
  });

  it('닉네임: 1~12자, 제어 문자·줄바꿈 제거, 비면 null', () => {
    expect(cleanNick('a\nb\tc')).toBe('a b c');
    expect(cleanNick('고양이'.repeat(10))).toHaveLength(12);
    expect(cleanNick('​ ')).toBeNull();
    expect(cleanNick(42)).toBeNull();
  });

  it('너무 긴 메시지·JSON이 아닌 것·모르는 종류는 버린다', () => {
    expect(parseClientMessage('x'.repeat(MAX_RAW + 1))).toBeNull();
    expect(parseClientMessage('{oops')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'admin' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify(null))).toBeNull();
  });

  it('방 이름: 맵 id와 방 번호. 맵 id는 소문자·숫자·-만', () => {
    expect(roomName('neighborhood', 2)).toBe('neighborhood#2');
    expect(roomName('../x', 1)).toBeNull();
    expect(roomName('a'.repeat(40), 1)).toBeNull();
  });
});
