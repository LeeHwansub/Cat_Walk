import { openContactDialog } from './contactDialog';
import { renderInfoPage } from './render';

/** 정보 페이지: 이용 방법 · 개인정보 처리방침 · 출처 (본문은 render.ts, 출처 데이터는 credits.ts) */
const root = document.getElementById('info')!;
root.innerHTML = renderInfoPage();
// 문의하기: 검은 고양이 문의 창 (contactDialog.ts)
const contactBtn = document.getElementById('btn-contact')!;
contactBtn.addEventListener('click', () => openContactDialog(contactBtn));
// 주소에 #credits 같은 위치가 있으면 그리기 뒤에 그곳으로 이동
if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
