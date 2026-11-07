import * as THREE from 'three';
import type { CatAppearance, PatternId } from './appearance';

/**
 * glb 고양이(캐릭터.glb)의 털 무늬·눈 색 재질.
 * 원본 텍스처는 64×64 그라데이션 팔레트라 무늬를 그릴 수 없다. 그래서 기준 자세의 정점 위치(모델 단위,
 * y 위·z 앞)로 부위를 나누고 셰이더에서 무늬를 계산한다. 귀 안쪽·코·입처럼 털이 아닌 부분은 원본 색을 쓴다.
 * 위치 기준값은 모델 정점 분석 결과다 (docs/ASSETS.md 6장).
 */
export const PATTERN_INDEX: Record<PatternId, number> = { solid: 0, tuxedo: 1, cheese: 2, mackerel: 3, calico: 4, tabbyWhite: 5 };

export interface CatSkinUniforms {
  uFur: { value: THREE.Color };
  uLight: { value: THREE.Color };
  uWhite: { value: THREE.Color };
  uStripe: { value: THREE.Color };
  uTip: { value: THREE.Color };
  uEye: { value: THREE.Color };
  uPattern: { value: number };
  /** 몸통을 노멀 방향으로 부풀리는 양 (모델 단위). 체형·풍선 */
  uInflate: { value: number };
  /** 털 겹 바깥쪽 끝까지의 길이 (모델 단위) */
  uFurLen: { value: number };
  /** 발바닥 패드 색 (털색·무늬에 따라 분홍 ~ 검정) */
  uPad: { value: THREE.Color };
  /** 패드 얼룩 색 (삼색 고양이는 분홍·검정이 섞인 패드) */
  uPadDark: { value: THREE.Color };
  /** 1인칭: 카메라에서 이 거리(m)보다 가까운 몸 표면은 그리지 않는다 (bodyNearCut). 0이면 끔 */
  uNearCut: { value: number };
  /** 몸 전체 보이는 정도 (1 = 다 보임). 3인칭 카메라가 바짝 붙으면 점무늬로 흐리게 */
  uFade: { value: number };
}

export function createCatSkinUniforms(): CatSkinUniforms {
  return {
    uFur: { value: new THREE.Color() },
    uLight: { value: new THREE.Color() },
    uWhite: { value: new THREE.Color('#f3efe8') },
    uStripe: { value: new THREE.Color() },
    uTip: { value: new THREE.Color() },
    uEye: { value: new THREE.Color() },
    uPattern: { value: 0 },
    uInflate: { value: 0 },
    uFurLen: { value: 0.05 },
    uPad: { value: PAD_PINK.clone() },
    uPadDark: { value: PAD_DARK.clone() },
    uNearCut: { value: 0 },
    uFade: { value: 1 },
  };
}

/**
 * 카메라에서 이 거리(m)보다 가까운 고양이 몸 표면은 그리지 않는다. 고양이 크기에 비례.
 * - 1인칭: 달릴 때 목·어깨가 카메라 약 5.6cm 앞까지 들어와 화면을 가렸다 (2026-11-07 측정).
 *   앞발(약 25cm)·가슴은 보이도록 9cm
 * - 3인칭: 표면을 뚫으면 구멍 너머로 몸 속이 보여 어색하다. 대신 몸 전체를 흐리게 한다 (uFade, bodyFade)
 */
export function bodyNearCut(firstPerson: boolean, scale: number): number {
  return firstPerson ? 0.09 * scale : 0;
}

const PAD_PINK = new THREE.Color('#e3a29d');
const PAD_SALMON = new THREE.Color('#de9a88');
const PAD_DARK = new THREE.Color('#2b2323');
const PAD_BRICK = new THREE.Color('#7a4440');

/**
 * 발바닥 패드 색. 실제 고양이처럼 발 털이 흰색이면 분홍, 털이 어두울수록 검정에 가깝고,
 * 치즈(주황) 고양이는 연어빛 분홍, 고등어(줄무늬)는 검정 ~ 벽돌빛이다.
 */
export function pawPadColor(a: CatAppearance): THREE.Color {
  if (a.pattern === 'tuxedo' || a.pattern === 'tabbyWhite' || a.pattern === 'calico') return PAD_PINK.clone();
  const fur = new THREE.Color(a.furColor);
  const lum = 0.2126 * fur.r + 0.7152 * fur.g + 0.0722 * fur.b;
  const t = THREE.MathUtils.smoothstep(lum, 0.03, 0.5);
  const light = a.pattern === 'cheese' ? PAD_SALMON : a.pattern === 'mackerel' ? PAD_BRICK : PAD_PINK;
  return PAD_DARK.clone().lerp(light, t);
}

/** 외형 값 → 셰이더 색 (도형 모델과 같은 규칙) */
export function applyAppearanceToUniforms(u: CatSkinUniforms, a: CatAppearance): void {
  const fur = new THREE.Color(a.furColor);
  u.uFur.value.copy(fur);
  u.uLight.value.copy(fur).lerp(new THREE.Color('#ffffff'), 0.35);
  const darkness = a.pattern === 'cheese' ? 0.62 : a.pattern === 'mackerel' ? 0.42 : 0.45;
  u.uStripe.value.copy(fur).multiplyScalar(darkness);
  u.uTip.value.copy(fur).multiplyScalar(a.pattern === 'cheese' ? 0.7 : 0.38);
  u.uEye.value.set(a.eyeColor);
  u.uPattern.value = PATTERN_INDEX[a.pattern];
  u.uPad.value.copy(pawPadColor(a));
}

/** 몸통 둘레 배율 → 부풀리는 양 (몸통 반폭 약 0.8 모델 단위 기준) */
export function inflateFor(girth: number): number {
  return (girth - 1) * 0.7;
}

const VERTEX_HEAD = /* glsl */ `
uniform float uInflate;
varying vec3 vRest;
#ifdef CAT_FUR
uniform float uFurLen;
uniform float uLayer;
varying float vFurMask;
/** 털 길이 배율: 털 텍스처 영역만, 머리는 짧게, 눈·코·발바닥은 없음 */
float catFurMask(vec3 p, vec2 tuv) {
  if (tuv.x >= 0.283) return 0.0;
  bool eye = abs(abs(p.x) - 0.345) < 0.16 && abs(p.y - 2.857) < 0.16 && p.z > 1.85;
  if (eye) return 0.0;
  float head = smoothstep(1.05, 1.3, p.z) * smoothstep(1.75, 2.05, p.y);
  float face = smoothstep(1.7, 1.9, p.z) * smoothstep(2.1, 2.3, p.y) * (1.0 - smoothstep(3.05, 3.2, p.y));
  return mix(1.0, 0.4, head) * (1.0 - face * 0.85) * smoothstep(0.02, 0.1, p.y);
}
#endif
float catBodyMask(vec3 p) {
  // 몸통(엉덩이~가슴)만. 머리·다리 아래쪽·꼬리는 그대로
  return smoothstep(-1.55, -1.15, p.z) * (1.0 - smoothstep(0.75, 1.15, p.z)) * smoothstep(0.55, 1.0, p.y);
}
`;

const VERTEX_BODY = /* glsl */ `
#include <begin_vertex>
vRest = position;
{
  float m = catBodyMask(position);
  transformed += objectNormal * uInflate * m;
  // 통통할수록 배가 아래로 처진다
  transformed.y -= max(uInflate, 0.0) * 0.35 * m * (1.0 - smoothstep(1.0, 1.6, position.y));
}
#ifdef CAT_FUR
vFurMask = catFurMask(position, uv);
transformed += objectNormal * uFurLen * uLayer * vFurMask;
#endif
`;

const FRAGMENT_HEAD = /* glsl */ `
#ifdef CAT_FUR
uniform float uLayer;
varying float vFurMask;
#endif
uniform vec3 uFur;
uniform vec3 uLight;
uniform vec3 uWhite;
uniform vec3 uStripe;
uniform vec3 uTip;
uniform vec3 uEye;
uniform float uPattern;
uniform vec3 uPad;
uniform vec3 uPadDark;
uniform float uNearCut;
uniform float uFade;
varying vec3 vRest;
/** 패드 부분 (거칠기를 낮춰 촉촉하게 보이게 한다) */
float catPadMask = 0.0;

float catHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float catNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(catHash(i), catHash(i + vec3(1, 0, 0)), f.x), mix(catHash(i + vec3(0, 1, 0)), catHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(catHash(i + vec3(0, 0, 1)), catHash(i + vec3(1, 0, 1)), f.x), mix(catHash(i + vec3(0, 1, 1)), catHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
/** 줄무늬 한 줄: 주기 1 안에서 폭 w */
float catBand(float s, float w) {
  s = fract(s);
  return smoothstep(0.0, 0.07, s) * (1.0 - smoothstep(w, w + 0.07, s));
}

vec3 catFurColor(vec3 p, vec3 orig) {
  int pat = int(uPattern + 0.5);
  float lum = dot(orig, vec3(0.2126, 0.7152, 0.0722));
  // 원본 그라데이션: 등은 어둡고 배·턱 아래는 밝다. 이 명암을 살린다
  float shade = mix(0.8, 1.06, smoothstep(0.02, 0.45, lum));
  float under = smoothstep(0.4, 0.85, lum);
  vec3 c = mix(uFur, uLight, under * 0.85);

  float isTail = smoothstep(-1.35, -1.5, p.z) * step(1.3, p.y);
  float isHead = smoothstep(1.05, 1.3, p.z) * smoothstep(1.75, 2.05, p.y);
  float isLeg = (1.0 - smoothstep(0.95, 1.25, p.y)) * (1.0 - isTail);
  float isBody = (1.0 - isTail) * (1.0 - isHead) * (1.0 - isLeg);

  float paws = 1.0 - smoothstep(0.26, 0.4, p.y);
  float chest = smoothstep(0.75, 1.05, p.z) * (1.0 - smoothstep(1.9, 2.2, p.y)) * (1.0 - smoothstep(0.25, 0.45, abs(p.x))) * (1.0 - isLeg * 0.6);
  float belly = (1.0 - smoothstep(1.0, 1.25, p.y)) * smoothstep(-1.1, -0.8, p.z) * (1.0 - smoothstep(0.75, 1.0, p.z)) * (1.0 - smoothstep(0.32, 0.55, abs(p.x)));
  float chin = isHead * (1.0 - smoothstep(2.3, 2.5, p.y)) * smoothstep(1.6, 1.9, p.z);

  if (pat == 2 || pat == 3 || pat == 5) {
    float wob = 0.18 * sin(p.y * 2.6 + p.x * 1.7) + 0.1 * catNoise(p * 2.0);
    float st = 0.0;
    st += isBody * catBand(p.z * 1.9 + wob, 0.32) * (1.0 - under * 0.7);
    // 등줄기: 등 가운데 진한 줄
    st = max(st, isBody * (1.0 - smoothstep(0.1, 0.22, abs(p.x))) * smoothstep(2.3, 2.6, p.y));
    st = max(st, isLeg * catBand(p.y * 2.7 + 0.15 * sin(p.z * 3.0), 0.3) * (1.0 - paws) * (1.0 - under * 0.5));
    st = max(st, isTail * catBand(-p.z * 2.3, 0.4));
    // 이마 M자: 눈 위에서 정수리로 올라가는 세 줄
    float fore = isHead * smoothstep(2.95, 3.1, p.y) * smoothstep(1.2, 1.7, p.z);
    float lines = max(1.0 - smoothstep(0.035, 0.07, abs(p.x)), 1.0 - smoothstep(0.035, 0.07, abs(abs(p.x) - 0.2)));
    st = max(st, fore * lines);
    // 볼 줄무늬
    st = max(st, isHead * smoothstep(0.5, 0.62, abs(p.x)) * catBand(p.y * 4.0, 0.3) * smoothstep(1.5, 1.8, p.z));
    c = mix(c, uStripe, st);
    // 진한 꼬리 끝
    c = mix(c, uTip, smoothstep(-2.85, -3.0, p.z) * isTail);
  }

  float white = 0.0;
  if (pat == 1) white = max(max(chest, belly), max(paws, chin));
  if (pat == 5) white = max(max(chest, belly * 0.9), max(paws, chin * 0.8));
  if (pat == 4) {
    white = max(max(chest, belly), max(paws, chin));
    // 삼색: 흰 바탕에 주황·검정 큰 얼룩 (얼룩 크기 약 1 모델 단위)
    float n = catNoise(p * 1.1 + vec3(3.1, 0.7, 1.9));
    float m = catNoise(p * 0.9 + vec3(-5.3, 2.2, 7.7));
    vec3 patchCol = m > 0.5 ? uFur : vec3(0.03, 0.026, 0.024);
    float patchMask = smoothstep(0.36, 0.44, n);
    c = mix(uWhite, patchCol * mix(1.0, 1.0, under), patchMask);
    white *= 0.95;
  }
  c = mix(c, uWhite, white);
  return c * shade;
}

/** 타원 거리 (0 = 경계, 음수 = 안쪽). r: 반지름 */
float catEll(vec2 q, vec2 c, vec2 r) {
  return length((q - c) / r) - 1.0;
}
/** 부드러운 합치기 (패드 가장자리를 매끈하게 잇는다) */
float catSmin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
/**
 * 발바닥: 큰 패드(뒤쪽이 세 갈래) 1개 + 발가락 패드 4개, 사이는 털.
 * 발마다 가운데 기준 좌표 q (x: 바깥쪽 +, y: 발가락 쪽 +, 대략 -1~1). 기준값은 정점 분석 결과 (docs/ASSETS.md 6장)
 */
vec3 catPadColor(vec3 p, vec3 fur) {
  bool front = p.z > 0.0;
  vec2 c = front ? vec2(0.418, 1.104) : vec2(0.538, -0.812);
  vec2 h = front ? vec2(0.13, 0.18) : vec2(0.105, 0.226);
  vec2 q = vec2((abs(p.x) - c.x) / h.x, (p.z - c.y) / h.y);
  // 큰 패드: 앞은 둥글고 뒤로 넓어지는 몸체. 뒤 가장자리는 세 갈래로 살짝 물결진다 (두 군데 오목)
  float d = catEll(q, vec2(0.0, -0.24), vec2(0.6, 0.36));
  d = catSmin(d, catEll(q, vec2(-0.34, -0.42), vec2(0.28, 0.2)), 0.1);
  d = catSmin(d, catEll(q, vec2(0.0, -0.5), vec2(0.28, 0.2)), 0.1);
  d = catSmin(d, catEll(q, vec2(0.34, -0.42), vec2(0.28, 0.2)), 0.1);
  d = -catSmin(-d, catEll(q, vec2(-0.17, -0.7), vec2(0.06, 0.11)), 0.08);
  d = -catSmin(-d, catEll(q, vec2(0.17, -0.7), vec2(0.06, 0.11)), 0.08);
  // 발가락 패드 4개: 앞쪽으로 부채꼴, 바깥 두 개는 조금 뒤. 앞쪽이 살짝 좁은 달걀꼴
  vec2 tq = q;
  float t = catEll(tq, vec2(-0.6, 0.24), vec2(0.17, 0.21));
  t = min(t, catEll(tq, vec2(-0.21, 0.54), vec2(0.18, 0.22)));
  t = min(t, catEll(tq, vec2(0.21, 0.54), vec2(0.18, 0.22)));
  t = min(t, catEll(tq, vec2(0.6, 0.24), vec2(0.17, 0.21)));
  float pd = min(d, t);
  float pad = 1.0 - smoothstep(-0.06, 0.04, pd);
  catPadMask = pad;

  vec3 col = uPad;
  // 삼색: 분홍과 검정 얼룩이 섞인 패드
  if (int(uPattern + 0.5) == 4) col = mix(col, uPadDark, smoothstep(0.5, 0.58, catNoise(p * 9.0 + vec3(1.7, 0.0, 4.2))));
  // 볼록한 느낌: 가장자리는 어둡고 가운데는 살짝 밝게, 표면에 잔주름
  float inner = smoothstep(0.0, -0.45, pd);
  col *= mix(0.74, 1.06, inner);
  col *= 0.96 + 0.08 * catNoise(p * 38.0 + vec3(0.37, 0.11, 0.73));
  // 패드 사이·둘레는 털 (뿌리 쪽이라 조금 어둡게)
  vec3 between = fur * 0.82;
  return mix(between, col, pad);
}

/** 눈: 원본은 검은 원. 홍채 색 + 세로 동공 + 하이라이트 */
vec3 catEyeColor(vec3 p) {
  vec2 q = vec2(abs(p.x) - 0.345, p.y - 2.857) / 0.115;
  float r = length(q);
  vec3 iris = uEye * mix(1.1, 0.55, smoothstep(0.35, 1.0, r));
  float pupil = 1.0 - smoothstep(0.85, 1.0, length(q * vec2(3.4, 1.05)));
  vec3 c = mix(iris, vec3(0.01), pupil);
  c = mix(c, vec3(0.02), smoothstep(0.88, 1.0, r)); // 테두리
  float glint = 1.0 - smoothstep(0.1, 0.16, length(q - vec2(sign(p.x) * 0.3, 0.38)));
  return mix(c, vec3(1.6), glint);
}
`;

const FRAGMENT_MAP = /* glsl */ `
// 1인칭: 카메라 바로 앞 몸 표면(목·어깨)은 그리지 않는다. 경계는 점무늬로 서서히.
// 3인칭: 카메라가 바짝 붙으면 몸 전체를 점무늬로 흐리게 (uFade)
if (uNearCut > 0.0) {
  float catNear = smoothstep(uNearCut * 0.75, uNearCut, length(vViewPosition));
  if (catNear < catHash(vec3(floor(gl_FragCoord.xy), 7.0))) discard;
}
if (uFade < 0.999 && uFade < catHash(vec3(floor(gl_FragCoord.xy), 3.0))) discard;
#ifdef CAT_FUR
  // 털 겹: 털이 없는 곳은 지우고, 바깥 겹일수록 가닥을 듬성하게 남긴다 (가닥 = 기준 위치의 작은 칸)
  if (vFurMask < 0.05) discard;
  if (catHash(floor(vRest * 110.0)) < uLayer * 0.92 + 0.04) discard;
#endif
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  vec3 catCol = sampledDiffuseColor.rgb;
  vec3 rp = vRest;
  // 눈: 눈 뼈를 따르는 눈 판(텍스처의 눈 영역 UV)만. 위치만 보면 눈 뒤 얼굴 표면까지 눈으로 칠해져
  // 깜빡일 때 그 자국이 남는다 (2026-11-07 "눈이 두 개로 보임" 수정)
  bool eyeUv = vMapUv.x > 0.875 || (vMapUv.x >= 0.375 && vMapUv.x < 0.5 && vMapUv.y >= 0.75) || (vMapUv.x < 0.125 && vMapUv.y >= 0.75);
  bool eye = eyeUv && abs(abs(rp.x) - 0.345) < 0.13 && abs(rp.y - 2.857) < 0.13 && rp.z > 1.92 && rp.z < 2.06;
  if (eye) {
    // 눈 정점은 둥근 사각형이라 원 바깥 모서리는 눈꺼풀 털로 칠한다
    float er = length(vec2(abs(rp.x) - 0.345, rp.y - 2.857) / 0.115);
    catCol = er < 1.0 ? catEyeColor(rp) : catFurColor(rp, vec3(0.25));
  } else if (rp.y < 0.012) {
    catCol = catPadColor(rp, catFurColor(rp, sampledDiffuseColor.rgb)); // 발바닥 (패드 + 털)
  } else if (vMapUv.x < 0.283) {
    catCol = catFurColor(rp, sampledDiffuseColor.rgb);
  } else if (vMapUv.x >= 0.75 && vMapUv.x < 0.875 && vMapUv.y < 0.4) {
    // 주둥이: 털색을 밝게 (턱시도는 흰색, 흰발·삼색은 흰색에 가깝게)
    int pat = int(uPattern + 0.5);
    catCol = pat == 1 ? uWhite : (pat == 4 || pat == 5) ? mix(uLight, uWhite, 0.6) : uLight;
  }
  diffuseColor.rgb *= catCol;
#endif
#ifdef CAT_FUR
  diffuseColor.rgb *= mix(0.62, 1.04, uLayer); // 뿌리 쪽은 어둡게
#endif
`;

/**
 * 원본 glb 재질을 바탕으로 무늬 재질을 만든다.
 * furLayer를 주면 털 겹 재질(0~1, 바깥 겹일수록 큼): 노멀 방향으로 부풀리고 가닥만 남긴다.
 */
export function createCatSkinMaterial(source: THREE.MeshStandardMaterial, uniforms: CatSkinUniforms, furLayer?: { value: number }): THREE.MeshStandardMaterial {
  const m = source.clone();
  m.roughness = 0.75;
  m.metalness = 0;
  if (furLayer) m.defines = { ...m.defines, CAT_FUR: '' };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (furLayer) shader.uniforms.uLayer = furLayer;
    shader.vertexShader = VERTEX_HEAD + shader.vertexShader.replace('#include <begin_vertex>', VERTEX_BODY);
    shader.fragmentShader =
      FRAGMENT_HEAD +
      shader.fragmentShader
        .replace('#include <map_fragment>', FRAGMENT_MAP)
        // 발바닥 패드는 촉촉하게: 거칠기를 낮춘다
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.4, catPadMask);');
  };
  m.customProgramCacheKey = () => (furLayer ? 'cat-skin-fur-v4' : 'cat-skin-v4');
  return m;
}
