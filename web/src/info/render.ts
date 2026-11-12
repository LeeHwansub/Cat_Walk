import { CREDITS, INFO_EFFECTIVE_DATE, OWN_ASSETS, type Credit } from './credits';

/**
 * 정보 페이지(이용 방법 · 개인정보 처리방침 · 출처) 본문을 만든다.
 * 문자열만 다루는 순수 함수라 테스트에서 그대로 확인한다.
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function link(url: string, text = url): string {
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

const COMMERCIAL_LABEL: Record<Credit['commercial'], string> = {
  unconfirmed: '확인 전 — 사용 권한이 확인될 때까지 상업적으로 배포하지 않습니다',
};

export function renderCredits(credits: Credit[] = CREDITS): string {
  const items = credits
    .map((c) => {
      const author = c.author.url ? link(c.author.url, c.author.name) : escapeHtml(c.author.name);
      const license = c.license.url ? link(c.license.url, c.license.name) : escapeHtml(c.license.name);
      const download = c.downloadUrl === c.sourceUrl ? '원본 페이지와 같음' : link(c.downloadUrl);
      return `
      <article class="credit">
        <h3>${escapeHtml(c.name)}</h3>
        <p class="role">${escapeHtml(c.role)}</p>
        <dl>
          <dt>제작자</dt><dd>${author}</dd>
          <dt>원본</dt><dd>${link(c.sourceUrl)}</dd>
          <dt>내려받은 곳</dt><dd>${download}</dd>
          <dt>라이선스</dt><dd>${license}${c.license.note ? `<br /><small>${escapeHtml(c.license.note)}</small>` : ''}</dd>
          <dt>상업적 배포</dt><dd>${escapeHtml(COMMERCIAL_LABEL[c.commercial])}</dd>
          <dt>수정 내역</dt><dd><ul>${c.changes.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul></dd>
        </dl>
      </article>`;
    })
    .join('');
  const own = OWN_ASSETS.map((x) => `<li>${escapeHtml(x)}</li>`).join('');
  return `${items}
      <h3>직접 만든 것</h3>
      <ul>${own}</ul>`;
}

export function renderInfoPage(): string {
  return `
  <header class="info-head">
    <h1>🐾 Cat Walk 정보</h1>
    <p class="date">시행일 ${INFO_EFFECTIVE_DATE}</p>
    <nav class="toc" aria-label="바로 가기">
      <a href="#howto">이용 방법</a>
      <a href="#privacy">개인정보 처리방침</a>
      <a href="#credits">출처·라이선스</a>
    </nav>
  </header>

  <section id="howto">
    <h2>이용 방법</h2>
    <h3>시작하기</h3>
    <ul>
      <li>첫 화면에서 <b>화면을 눌러 시작</b>하면(아무 곳이나 누르거나 아무 키) 시작 메뉴가 나옵니다.</li>
      <li><b>시작하기</b>로 고양이를 만들고(프리셋 또는 털색·무늬·눈·귀·크기·체형 직접 선택) 동네로 나갑니다.</li>
      <li>진행 상황은 자동으로 저장되어 다음에 <b>이어하기</b>로 계속할 수 있습니다.</li>
    </ul>
    <h3>조작</h3>
    <ul>
      <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 또는 방향키: 이동 (누르면 직접 조작으로 바뀝니다)</li>
      <li><kbd>Shift</kbd>를 누른 채 이동: 달리기</li>
      <li><kbd>Space</kbd>: 점프 (앞에 담·평상·차 보닛이 있으면 올라가고, 높은 곳에서는 뛰어내립니다)</li>
      <li>마우스 드래그: 카메라 회전 · 휠: 확대/축소</li>
      <li>고양이 클릭: 쓰다듬기</li>
      <li><kbd>C</kbd>: 3인칭 ↔ 고양이 시점 · <kbd>F</kbd>: 먹이 주기 · <kbd>Esc</kbd>: 설정</li>
      <li><kbd>P</kbd>: 포즈 (고양이 둘레에서 자세를 고르면 움직일 때까지 그 자세를 합니다)</li>
      <li><kbd>M</kbd>: 지도 (다른 맵으로 옮기기)</li>
      <li><kbd>Enter</kbd>: 채팅 (함께 놀기 중)</li>
    </ul>
    <h3>휴대폰</h3>
    <ul>
      <li>왼쪽 아래 <b>조이스틱</b>을 민 방향으로 걷고, 끝까지 밀면 달립니다.</li>
      <li>오른쪽 아래 <b>점프 버튼</b>으로 뜁니다. 화면을 끌면 카메라가 돌아갑니다.</li>
    </ul>
    <h3>맵</h3>
    <ul>
      <li><b>골목과 공원</b>: 주택가 골목과 연못이 있는 작은 공원</li>
      <li><b>들판</b>: 꽃이 핀 넓은 풀밭과 부들이 자라는 연못, 피크닉 테이블</li>
      <li>화면 아래 <b>지도</b> 버튼이나 <kbd>M</kbd>으로 맵을 고릅니다. 마지막에 있던 맵에서 이어서 시작합니다.</li>
    </ul>
    <h3>함께 놀기</h3>
    <ul>
      <li>같은 맵에 있는 사람들(맵마다 방이 따로, 한 방에 8명까지)의 고양이가 닉네임과 함께 보이고, 채팅을 주고받을 수 있습니다.</li>
      <li>닉네임은 고양이를 만들 때나 설정에서 정합니다. 설정에서 <b>함께 놀기</b>를 끄면 혼자 놉니다.</li>
    </ul>
    <h3>자동 생활과 직접 조작</h3>
    <ul>
      <li><b>자동 생활</b>: 고양이가 스스로 걷고, 냄새 맡고, 쉬고, 배가 고프면 그릇을 찾아갑니다.</li>
      <li><b>직접 조작</b>: 키보드로 고양이를 움직입니다. 화면 아래 버튼으로 바꿀 수 있습니다.</li>
    </ul>
  </section>

  <section id="privacy">
    <h2>개인정보 처리방침</h2>
    <h3>한눈에 보기</h3>
    <p>시행일: 2026년 11월 12일</p>
    <p>Cat Walk는 회원가입·로그인이 없고, 게임 기록은 이용자의 브라우저 안에만 저장됩니다. <b>운영자는 개인정보를 수집·저장하지 않습니다.</b>
    다만 <b>함께 놀기</b>를 켜 두면 아래 정보가 같은 방에 있는 다른 이용자에게 전달되고, 접속자 수를 세기 위해 <b>metaBus</b>로 접속 신호를 보냅니다.</p>
    <h3>브라우저에 저장하는 것</h3>
    <ul>
      <li>저장 위치: 브라우저 저장소(localStorage), 항목 이름 <code>cat-walk/save</code></li>
      <li>내용: 만든 고양이의 외형, 닉네임, 배고픔 정도, 지금 맵과 마지막 위치, 설정(소리·털 표현·함께 놀기 등)</li>
      <li>이 저장 내용은 서버에 보관하지 않으며, 다른 기기와 동기화되지 않습니다. (함께 놀기 중 닉네임·외형은 아래처럼 다른 이용자에게 전달됩니다.)</li>
    </ul>
    <h3>함께 놀기에서 주고받는 것</h3>
    <ul>
      <li>전달하는 정보: 닉네임, 고양이 외형, 게임 안 위치·방향·자세, 채팅 내용</li>
      <li>받는 사람: 같은 맵의 같은 방(최대 8명)에 있는 이용자</li>
      <li>방 서버(Cloudflare Workers·Durable Objects)는 정보를 전달만 하고 기록으로 저장하지 않습니다. 방을 나가면 그 정보는 사라집니다.</li>
      <li>접속할 때 IP 주소 등 접속 정보는 서비스 제공업체(Cloudflare)가 서비스 운영과 보안을 위해 처리합니다.
        자세한 내용은 <a href="https://www.cloudflare.com/ko-kr/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare 개인정보 처리방침</a>을 참고해 주세요.</li>
      <li>채팅은 저장하거나 검토하지 않습니다. 실명, 연락처 등 개인정보를 채팅에 쓰지 마세요.</li>
      <li>끄는 방법: 게임 안 설정 → <b>함께 놀기</b> 해제 (이후로는 접속하지 않습니다)</li>
    </ul>
    <h3>접속자 수 집계 (metaBus)</h3>
    <ul>
      <li>목적: Cat Walk가 metaBus(<a href="https://metabus.app" target="_blank" rel="noopener noreferrer">metabus.app</a>)에 등록된 사이트임을 증명하고, 지금 접속 중인 사람 수를 세어 보여 주기 위해서입니다.</li>
      <li>브라우저에 저장하는 것: 무작위로 만든 방문자 ID 하나(<code>mb_vid</code>, 브라우저 저장소). 이름·계정과 연결되지 않습니다.</li>
      <li>보내는 것: 사이트 ID, 방문자 ID, 들어올 때·접속 중·나갈 때의 접속 신호, 들어올 때 이전 사이트의 주소(도메인만, 경로 제외)</li>
      <li>받는 곳: metaBus 서버(<code>sdk.metabus.app</code>에서 스크립트를 받고, <code>api.metabus.app</code>으로 신호를 보냄). 이때 IP 주소 등 접속 정보가 metaBus에 전달될 수 있습니다.</li>
      <li>함께 놀기를 꺼도 이 집계는 동작합니다. 게임 안에는 끄는 설정이 없으며, 브라우저 설정에서 이 사이트의 데이터를 지우면 방문자 ID도 지워집니다.</li>
    </ul>
    <h3>수집·전송하지 않는 것</h3>
    <ul>
      <li>이메일, 전화번호, 실제 위치 등 개인을 알아볼 수 있는 정보</li>
      <li>쿠키, 광고, 위 접속자 수 집계 외의 방문 통계·분석 도구</li>
      <li>게임은 자체 파일(화면·모델·소리), 함께 놀기를 켰을 때 같은 사이트의 방 서버, 위 metaBus에만 접속합니다.</li>
    </ul>
    <h3>기록 삭제 방법</h3>
    <ul>
      <li>게임 안: 설정 → <b>저장 초기화</b></li>
      <li>또는 브라우저 설정에서 이 사이트의 데이터(사이트 데이터·저장소)를 삭제</li>
    </ul>
    <h3>외부 링크</h3>
    <p>출처 안내의 링크를 누르면 해당 사이트(Sketchfab, Free3D 등)로 이동하며, 그 사이트의 개인정보 정책이 적용됩니다.</p>
    <h3>변경</h3>
    <p>내용이 바뀌면 이 페이지에 시행일과 함께 알립니다.</p>
    <h3>문의</h3>
    <p>게임, 개인정보, 출처에 대해 궁금한 점은 아래 버튼으로 문의해 주세요. 이용자의 메일 프로그램으로 보내며, 게임이 따로 저장하지 않습니다.</p>
    <p><button type="button" id="btn-contact" class="contact-btn">문의하기</button></p>
  </section>

  <section id="credits">
    <h2>출처·라이선스</h2>
    <p class="notice">아래 에셋은 각 제작자의 저작물입니다. <b>상업적 배포 가능 여부는 확인 전</b>이며, 확인될 때까지 상업적으로 배포하지 않습니다.</p>
    ${renderCredits()}
  </section>

  <footer class="info-foot"><a href="./">← 게임으로 돌아가기</a></footer>`;
}
