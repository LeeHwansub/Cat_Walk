// 포즈 메뉴 실루엣 만들기: 게임 고양이를 자세마다 검게 렌더해 PNG로 저장한다.
// 실행 (개발 서버가 켜져 있어야 함, 저장소 루트에서):
//   node tools/pose-icons/capture.mjs [http://localhost:5173/] [web/public/assets/ui/poses]
// macOS Chrome 경로를 쓴다. 다른 환경이면 CHROME 환경변수로 경로를 준다.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://localhost:5173/';
const outDir = process.argv[3] ?? 'web/public/assets/ui/poses';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// 자세와 찍는 때: hold = 자세가 자리 잡을 게임 시간(초), at = 한 번 하는 동작의 진행 비율
// back = 반대쪽 옆에서 찍고 좌우를 뒤집는다 (꼬리 감기는 꼬리가 반대쪽에 감긴다)
const POSES = [
  { id: 'sit', hold: 3 },
  { id: 'manSit', hold: 3.5 },
  { id: 'loaf', hold: 4 },
  { id: 'nap', hold: 4.5 },
  { id: 'tailWrap', hold: 4.5, back: true },
  { id: 'stretch', at: 0.5 },
  { id: 'groom', at: 0.35 },
  { id: 'lookAround', at: 0.4 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'pose-icons-'));
const port = 9341;
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=900,700', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });

let ws;
for (let i = 0; i < 50 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    const s = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => ((s.onopen = res), (s.onerror = rej)));
    ws = s;
  } catch {
    await sleep(200);
  }
}
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg), pending.delete(msg.id);
};
const send = (method, params = {}) => new Promise((res) => (pending.set(++id, res), ws.send(JSON.stringify({ id, method, params }))));
const run = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
const until = async (expression, ms = 60000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await run(expression)) return;
    await sleep(150);
  }
  throw new Error('시간 초과: ' + expression);
};

await send('Runtime.enable');
await send('Page.navigate', { url });
await until('!!window.__catWalk && !!window.__catWalk.rig');
// 기본 고양이(성체, 선 귀)로 놀이 화면을 열고, 고양이만 남긴다
await run(`(() => {
  const g = window.__catWalk;
  g.setPhase('play');
  document.querySelectorAll('.screen').forEach((e) => e.classList.add('hidden'));
  g.setAppearance({ ...g.save.cat, stage: 'adult', size: 1, build: 1, ear: 'up' });
  g.ctrl.x = -6; g.ctrl.z = 0.3; g.ctrl.y = 0; g.ctrl.heading = Math.PI / 2;
  return true;
})()`);
await sleep(1500);

mkdirSync(outDir, { recursive: true });
for (const p of POSES) {
  await run(`(() => { const g = window.__catWalk; g.ctrl.x = -6; g.ctrl.z = 0.3; g.ctrl.heading = Math.PI / 2; g.doPose('${p.id}'); window.__t0 = g.time; return true; })()`);
  if (p.hold) await until(`window.__catWalk.time - window.__t0 > ${p.hold}`);
  else await until(`(() => { const g = window.__catWalk; return g.brain.current.id === '${p.id}' && g.brain.progress(g.time) >= ${p.at}; })()`);
  // 고양이만 보이게 하고 검은 재질로 옆에서 렌더 → 밝기를 투명도로 바꿔 잘라낸다 (한 번에, 다음 프레임 전에)
  const data = await run(`(() => {
    const g = window.__catWalk, st = g.stage, scene = st.scene, r = st.renderer;
    const keep = new Set([g.rig.root]);
    const hidden = [];
    for (const o of scene.children) if (!keep.has(o) && !o.isLight && o.visible) { o.visible = false; hidden.push(o); }
    const bg = scene.background, fog = scene.fog;
    scene.background = null; scene.fog = null;
    let M = null;
    g.rig.root.traverse((o) => { if (!M && o.isMesh && o.material && o.material.isMeshStandardMaterial) M = o.material.constructor; });
    const black = new M({ color: 0x000000, roughness: 1, metalness: 0 });
    scene.overrideMaterial = black;
    r.setClearColor(0xffffff, 1);
    const cam = g.cam.active.clone();
    const c = g.rig.root.position;
    cam.fov = 30; cam.aspect = r.domElement.width / r.domElement.height; cam.near = 0.05; cam.far = 20;
    cam.position.set(c.x, c.y + 0.3, c.z + ${p.back ? -2.2 : 2.2});
    cam.lookAt(c.x, c.y + 0.15, c.z);
    cam.updateProjectionMatrix();
    r.render(scene, cam);
    const w = r.domElement.width, h = r.domElement.height;
    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
    const tc = tmp.getContext('2d'); tc.drawImage(r.domElement, 0, 0);
    scene.overrideMaterial = null; scene.background = bg; scene.fog = fog;
    for (const o of hidden) o.visible = true;
    const img = tc.getImageData(0, 0, w, h); const d = img.data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = 255 - Math.round((d[i] + d[i + 1] + d[i + 2]) / 3);
      d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = a;
      if (a > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    tc.putImageData(img, 0, 0);
    const OW = 128, OH = 112, pad = 6;
    const s = Math.min((OW - pad * 2) / (x1 - x0 + 1), (OH - pad * 2) / (y1 - y0 + 1));
    const out = document.createElement('canvas'); out.width = OW; out.height = OH;
    const oc = out.getContext('2d'); oc.imageSmoothingQuality = 'high';
    const dw = (x1 - x0 + 1) * s, dh = (y1 - y0 + 1) * s;
    if (${!!p.back}) { oc.translate(OW, 0); oc.scale(-1, 1); }
    oc.drawImage(tmp, x0, y0, x1 - x0 + 1, y1 - y0 + 1, (OW - dw) / 2, OH - pad - dh, dw, dh);
    return out.toDataURL('image/png');
  })()`);
  writeFileSync(join(outDir, `${p.id}.png`), Buffer.from(data.split(',')[1], 'base64'));
  console.log('saved', p.id);
}

ws.close();
chrome.kill();
await sleep(300);
rmSync(profile, { recursive: true, force: true });
process.exit(0);
