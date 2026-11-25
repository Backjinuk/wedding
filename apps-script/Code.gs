/**
 * 모바일 청첩장 서버 (Google Apps Script)
 * - 방명록: 구글 드라이브의 JSON 파일 하나(wedding-guestbook.json)에 저장. DB 없음
 * - 참석 회신: 구글 시트(청첩장 참석 회신)에 한 줄씩 추가
 * 설치 방법은 같은 폴더의 README.md 참고
 */
const GB_FILE_NAME = 'wedding-guestbook.json';
const RSVP_SHEET_NAME = '청첩장 참석 회신';
const props = PropertiesService.getScriptProperties();

// 최초 1회 실행: 권한 승인 + 파일 생성. 실행 로그에 파일 주소가 찍힘
function setup() {
  Logger.log('방명록 JSON: ' + gbFile().getUrl());
  Logger.log('참석 회신 시트: ' + rsvpSheet().getParent().getUrl());
}

function doGet(e) {
  if ((e.parameter.type || 'guestbook') === 'guestbook') return out({ ok: true, entries: publicList(readGb()) });
  return out({ ok: false, error: 'unknown type' });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad request' }); }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // 동시에 여러 명이 써도 파일이 꼬이지 않게
  try {
    if (d.type === 'guestbook') {
      const name = clean(d.name, 20), msg = clean(d.msg, 300), pw = String(d.pw || '');
      if (!name || !msg || pw.length < 4) return out({ ok: false, error: 'invalid' });
      const list = readGb();
      list.push({ id: Utilities.getUuid(), name: name, msg: msg, at: new Date().toISOString(), pw: hash(pw) });
      writeGb(list);
      return out({ ok: true, entries: publicList(list) });
    }

    if (d.type === 'guestbook-delete') {
      const list = readGb();
      const i = list.findIndex(function (x) { return x.id === d.id; });
      if (i < 0) return out({ ok: false, error: 'not found' });
      if (list[i].pw !== hash(String(d.pw || ''))) return out({ ok: false, error: 'password' });
      list.splice(i, 1);
      writeGb(list);
      return out({ ok: true, entries: publicList(list) });
    }

    if (d.type === 'rsvp') {
      rsvpSheet().appendRow([new Date(), clean(d.side, 10), clean(d.attend, 10), clean(d.meal, 10), clean(d.name, 20), Math.min(20, Number(d.count) || 1)]);
      return out({ ok: true });
    }

    return out({ ok: false, error: 'unknown type' });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 방명록 JSON 파일 ---------- */
function gbFile() {
  const id = props.getProperty('GB_FILE_ID');
  if (id) return DriveApp.getFileById(id);
  const f = DriveApp.createFile(GB_FILE_NAME, '[]', 'application/json');
  props.setProperty('GB_FILE_ID', f.getId());
  return f;
}
function readGb() {
  try { return JSON.parse(gbFile().getBlob().getDataAsString('utf-8')) || []; } catch (e) { return []; }
}
function writeGb(list) { gbFile().setContent(JSON.stringify(list, null, 1)); }
// 비밀번호 해시는 밖으로 내보내지 않음
function publicList(list) {
  return list.map(function (x) { return { id: x.id, name: x.name, msg: x.msg, at: x.at }; })
             .sort(function (a, b) { return a.at < b.at ? 1 : -1; });
}

/* ---------- 참석 회신 시트 ---------- */
function rsvpSheet() {
  const id = props.getProperty('RSVP_SHEET_ID');
  if (id) return SpreadsheetApp.openById(id).getSheets()[0];
  const ss = SpreadsheetApp.create(RSVP_SHEET_NAME);
  props.setProperty('RSVP_SHEET_ID', ss.getId());
  const sh = ss.getSheets()[0];
  sh.appendRow(['시각', '구분', '참석', '식사', '성함', '인원']);
  sh.setFrozenRows(1);
  return sh;
}

/* ---------- 공통 ---------- */
function hash(pw) {
  let salt = props.getProperty('SALT');
  if (!salt) { salt = Utilities.getUuid(); props.setProperty('SALT', salt); }
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + pw, Utilities.Charset.UTF_8));
}
function clean(s, max) { return String(s || '').replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().slice(0, max); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
