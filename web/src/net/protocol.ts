import { sanitizeAppearance, type CatAppearance } from '../cat/appearance';
import type { AnimBehavior } from '../behavior/types';

/**
 * 멀티플레이 메시지 형식 (클라이언트 ↔ Cloudflare Durable Object 방, D-59).
 * 같은 맵에 있는 사람끼리 한 방(정원 8명, 차면 다음 방). 서로의 고양이 위치·자세·닉네임·채팅만 주고받고 저장하지 않는다.
 * 서버와 클라이언트가 이 파일을 함께 쓴다: 서버는 받는 모든 값을 여기서 검사한다.
 */

export const MAX_PLAYERS = 8;
/** 받는 메시지 한 개의 최대 길이 (글자) */
export const MAX_RAW = 1024;
export const NICK_MAX = 12;
export const CHAT_MAX = 100;
/** 방 하나가 다 차면 다음 방으로. 맵 하나에 이 수까지 */
export const MAX_ROOMS_PER_MAP = 20;
/** 접속 주소 (같은 사이트) */
export const ROOM_PATH = '/api/room';

/** 다른 사람의 고양이를 그리는 데 필요한 상태 */
export interface CatState {
  x: number;
  z: number;
  /** 보이는 몸 높이 (계단·담 위·풍선) */
  y: number;
  /** 바라보는 방향 (rad) */
  h: number;
  /** 몸 기울기 (rad, 계단) */
  p: number;
  /** 행동 (자세) */
  b: AnimBehavior;
  /** 이동 속도 (m/s) */
  v: number;
  /** 행동 진행 0~1 (기지개·그루밍처럼 진행에 따라 모양이 바뀌는 동작) */
  g: number;
}

export interface PeerInfo {
  id: string;
  nick: string;
  look: CatAppearance;
  s: CatState | null;
}

export type ClientMessage = { t: 'hello'; nick: string; look: CatAppearance } | { t: 's'; s: CatState } | { t: 'chat'; text: string };

export type ServerMessage =
  | { t: 'welcome'; id: string; room: string; peers: PeerInfo[] }
  | { t: 'join'; peer: PeerInfo }
  | { t: 'leave'; id: string }
  | { t: 's'; id: string; s: CatState }
  | { t: 'chat'; id: string; nick: string; text: string };

/** 주고받을 수 있는 행동 이름 (AnimBehavior 전부) */
export const ANIM_BEHAVIORS = [
  'idle', 'walk', 'sit', 'lookAround', 'sniff', 'groom', 'nap', 'eat',
  'loaf', 'sideLie', 'bellyUp', 'stretch', 'tailWrap', 'manSit', 'lickLips',
] as const satisfies readonly AnimBehavior[];
/** AnimBehavior가 늘면 위 목록에도 넣어야 컴파일된다 */
export type MissingBehaviors = Exclude<AnimBehavior, (typeof ANIM_BEHAVIORS)[number]> extends never ? true : never;
const behaviorCheck: MissingBehaviors = true;
void behaviorCheck;

/** 제어 문자·보이지 않는 문자 (줄바꿈·탭은 공백으로 바꾼 뒤 지운다) */
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\n\r\t]/g, ' ').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
  if (s.length === 0) return null;
  return Array.from(s).slice(0, max).join('');
}

/** 닉네임: 1~12자 (글자 단위), 제어 문자 제거. 비면 null */
export function cleanNick(v: unknown): string | null {
  return clean(v, NICK_MAX);
}

/** 채팅: 1~100자, 제어 문자 제거. 비면 null */
export function cleanChat(v: unknown): string | null {
  return clean(v, CHAT_MAX);
}

const inRange = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

function parseState(r: Record<string, unknown>): CatState | null {
  const b = r.b;
  if (typeof b !== 'string' || !(ANIM_BEHAVIORS as readonly string[]).includes(b)) return null;
  const { x, z, y, h, p, v, g } = r;
  if (!inRange(x, -500, 500) || !inRange(z, -500, 500) || !inRange(y, -5, 60) || !inRange(h, -50, 50) || !inRange(p, -2, 2) || !inRange(v, 0, 10) || !inRange(g, 0, 1)) return null;
  return { x, z, y, h, p, b: b as AnimBehavior, v, g };
}

/** 받은 문자열을 검사한다. 이상하면 null (서버는 버린다) */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > MAX_RAW) return null;
  let r: unknown;
  try {
    r = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof r !== 'object' || r === null || Array.isArray(r)) return null;
  const m = r as Record<string, unknown>;
  switch (m.t) {
    case 'hello': {
      const nick = cleanNick(m.nick);
      return nick ? { t: 'hello', nick, look: sanitizeAppearance(m.look) } : null;
    }
    case 's': {
      const s = parseState(m);
      return s ? { t: 's', s } : null;
    }
    case 'chat': {
      const text = cleanChat(m.text);
      return text ? { t: 'chat', text } : null;
    }
    default:
      return null;
  }
}

/** 방 이름 (Durable Object 이름): `맵#번호`. 맵 id가 이상하면 null */
export function roomName(mapId: string, n: number): string | null {
  if (!/^[a-z0-9-]{1,32}$/.test(mapId) || !Number.isInteger(n) || n < 1 || n > MAX_ROOMS_PER_MAP) return null;
  return `${mapId}#${n}`;
}
