/**
 * 문의하기 (정보 페이지). 서버 없이 이용자의 메일 프로그램으로 보낸다 (mailto).
 * 문의처: 사용자 지정 (2026-11-07). 정보 페이지 본문에는 주소를 그대로 쓰지 않고, 문의 창 안에서만 보여 준다.
 */
export const CONTACT_EMAIL = 'dyfrkfl1@gmail.com';

/** 문의 창에서 검은 고양이가 먼저 묻는 말 */
export const CONTACT_QUESTION = '무엇을 문의하러 오셨냐옹?';

export interface ContactTopic {
  id: 'bug' | 'idea' | 'credit' | 'etc';
  label: string;
  /** 메일 본문에 미리 넣는 안내 */
  body: string;
}

export const CONTACT_TOPICS: ContactTopic[] = [
  { id: 'bug', label: '버그 신고', body: '어떤 상황에서 문제가 생겼는지 적어 주세요.\n- 사용한 기기/브라우저:\n- 일어난 일:\n- 기대한 동작:\n' },
  { id: 'idea', label: '제안·의견', body: '고양이와 함께하는 시간이 더 즐거워질 아이디어를 들려주세요.\n' },
  { id: 'credit', label: '출처·저작권', body: '관련된 에셋(모델·소리)과 내용을 적어 주세요.\n' },
  { id: 'etc', label: '기타', body: '' },
];

/** 받는 사람·제목·본문을 담은 메일 쓰기 주소 */
export function mailtoUrl(topic: ContactTopic): string {
  const subject = `[Cat Walk] ${topic.label}`;
  const body = `${topic.body}\n---\nCat Walk 정보 페이지에서 보낸 문의입니다.`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
