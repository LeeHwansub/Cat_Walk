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
      <li><b>시작하기</b>로 고양이를 만들고(프리셋 또는 털색·무늬·눈·귀·크기·체형 직접 선택) 동네로 나갑니다.</li>
      <li>진행 상황은 자동으로 저장되어 다음에 <b>이어하기</b>로 계속할 수 있습니다.</li>
    </ul>
    <h3>조작</h3>
    <ul>
      <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 또는 방향키: 이동 (누르면 직접 조작으로 바뀝니다)</li>
      <li><kbd>Shift</kbd>를 누른 채 이동: 달리기</li>
      <li>마우스 드래그: 카메라 회전 · 휠: 확대/축소</li>
      <li>고양이 클릭: 쓰다듬기</li>
      <li><kbd>C</kbd>: 3인칭 ↔ 고양이 시점 · <kbd>F</kbd>: 먹이 주기 · <kbd>Esc</kbd>: 설정</li>
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
    <p>Cat Walk는 <b>개인정보를 수집하지 않습니다.</b> 회원가입·로그인이 없고, 게임 기록은 이용자의 브라우저 안에만 저장됩니다.</p>
    <h3>브라우저에 저장하는 것</h3>
    <ul>
      <li>저장 위치: 브라우저 저장소(localStorage), 항목 이름 <code>cat-walk/save</code></li>
      <li>내용: 만든 고양이의 외형, 배고픔 정도, 마지막 위치, 설정(소리·털 표현 등)</li>
      <li>이 정보는 서버로 보내지 않으며, 다른 기기와 동기화되지 않습니다.</li>
    </ul>
    <h3>수집·전송하지 않는 것</h3>
    <ul>
      <li>이름, 이메일, 전화번호, 위치 등 개인을 알아볼 수 있는 정보</li>
      <li>쿠키, 방문 통계·분석 도구, 광고</li>
      <li>게임은 자체 파일(화면·모델·소리)만 불러오며 외부 서비스에 접속하지 않습니다.</li>
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
