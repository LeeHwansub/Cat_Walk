import { MAX_ROOMS_PER_MAP, ROOM_PATH, roomName } from '../src/net/protocol';
import type { Room } from './room';

export { Room } from './room';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
}

/**
 * Cat Walk 서버 (Cloudflare Workers, D-59).
 * /api/room?map=<맵 id>: 그 맵의 방에 WebSocket으로 들어간다. 1번 방부터 정원(8명)이 남은 방으로.
 * 나머지 주소는 정적 파일(web/dist).
 */
export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === ROOM_PATH) return joinRoom(request, env, url);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function joinRoom(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
  // 다른 사이트의 페이지가 접속하지 못하게: 같은 주소(개발 중에는 localhost)만
  const origin = request.headers.get('Origin');
  if (origin && !sameSite(origin, url)) return new Response('forbidden', { status: 403 });
  const map = url.searchParams.get('map') ?? '';
  for (let n = 1; n <= MAX_ROOMS_PER_MAP; n++) {
    const name = roomName(map, n);
    if (!name) return new Response('bad map', { status: 400 });
    const res = await env.ROOMS.get(env.ROOMS.idFromName(name)).fetch(request);
    if (res.status !== 409) return res;
  }
  return new Response('all rooms full', { status: 503 });
}

function sameSite(origin: string, url: URL): boolean {
  try {
    const o = new URL(origin);
    return o.host === url.host || o.hostname === 'localhost' || o.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
