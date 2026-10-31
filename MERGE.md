# ot-hub → rehab-hub 합치기 안내

ot-hub는 **프로토타입**입니다. 나중에 rehab-hub(`~/Desktop/rehab-hub`, Electron 31 · 도구 = `renderer/tools/*.html` + `renderer/core/*.js` · 파일은 `window.rehab.folders.*`)에 합칠 때
손볼 곳을 한 군데로 모으도록 구조를 나눠 두었습니다.

## 구조
```
shared/        공용 — dates(날짜) · xl(엑셀 읽기 어댑터) · files(파일 역할) · staff(팀 시트) · status(현황판) · timetable(환자 전체시간표 카드) · off(주치의 off) · messenger(퇴원)
modules/<id>/  기능 하나 = 폴더 하나
   index.js      IPC 등록 (메인 프로세스)           ← rehab-hub에서는 main/ipc/*.ipc.js 로
   logic/계산 파일  순수 계산(화면·Electron 모름)      ← 그대로 renderer/core 로 옮김
   export/build  결과 엑셀 만들기                     ← 쓰기 방식만 교체
renderer/modules/<id>.js   화면 — Hub.register({id,title,render(root)})   ← 도구 페이지(tools/*.html) 한 장
```

## 화면 틀
`renderer/shell.css`·`index.html`은 rehab-hub와 같은 틀(상단바 + 어두운 사이드바 + 카드)로 맞춰 두었다. 합칠 때는 각 `renderer/modules/<id>.js`의 `render(root)`를 rehab-hub의 `.view` 안 카드에 넣으면 되고, 글꼴(Pretendard)·색상 변수는 같다.

## 합칠 때 바꿀 것 (이것만)
| 항목 | 지금(ot-hub) | rehab-hub |
|---|---|---|
| 엑셀 읽기 | `shared/xl.js` (ExcelJS) | SheetJS(`xlsx.full.min.js`) + `window.rehab.folders.readFile(path)` — `xl.js`의 `open/txt` 두 함수와 `modules/*/(history·schedule·sci·emr·ccrt …)`의 `getCell` 읽기 코드만 교체 |
| 엑셀 쓰기 | ExcelJS `xlsx.writeFile` | rehab-hub `main/exportSaver.js` / `xlsxwrite` 방식 |
| 퇴원 일정 | `shared/messenger.js` (sql.js) | 이미 있는 `main/messenger/reader.js`(better-sqlite3)의 `admission_discharge_entries` 조회로 대체 |
| 파일 연결 | `shared/files.js` ROLES + 「파일 연결」 화면 | rehab-hub `folderStore`·`fileRoles`에 같은 역할 이름(status, eval …)을 등록 |
| 설정 | `settings.json` 의 `mod.<id>` | rehab-hub `prefs`/`state` 저장소 |
| 화면 호출 | `Hub.invoke('모듈:동작')` | `window.rehab.*` 호출 |

## 그대로 옮기는 것 (순수 로직 — 시험 포함)
- 청소: `cleaning/assign.js`(균등·새 구역 우선) · `bigclean.js` · `history.js`의 `parseSheet`
- 평가일: `eval/plan.js` · `cycle.js`(산재) · `ccrt.js`(planCcrt) — 날짜는 전부 'YYYY-MM-DD' 문자열
- 신환 명단: `roster/roster.js` · `emr.js`의 `itemsOf`(EMR 평가 처방 코드 → 평가항목)
- SCI 명단: `sci/sci.js`의 `buildList` (규칙 ① 현황판 색상 ② SCIM + 전체시간표 카드가 '재활치료 스케줄'(회복기 글자 없음) — `shared/timetable.js`)
- 출근부: `attendance/build.js`(+`shared/staff.js` 정렬)
- 도구 목록: `inventory/logic.js`의 `match/apply` · `request.js`(청구서 시트 읽기 — 4블록 × [물품|규격|수량|사유], '기타 주문건' 아래는 직접 기재 칸)
- 낙상 순회: `fall/logic.js`의 `generate/check/build` (읽기 부분 `parseRoster/parseMonth`만 교체)
- 자동 업데이트: `shared/updater.js`(electron 모름, 시험 있음) — rehab-hub에는 이미 `main/updater.js`가 있으니 합칠 때는 그쪽을 쓰고 이 파일은 버린다
- 청소 배치도: `cleaning/floorplan.js`(Sheet1 → 칸·색) + 화면의 MAP(칸 글자 → 구역) — 합칠 때 화면 쪽 MAP만 옮김

## 내보내기(서식) 원칙
모든 내보내기는 **원본 파일의 서식을 그대로** 쓴다 — 새로 그리지 않고 원본을 열어 값만 바꾼다.
- 출근부: 원본이 조건부 서식(x14)·쪽 나눔을 써서 ExcelJS로는 못 다루므로 엑셀 파일 안쪽(XML)을 직접 편집 (`attendance/template.js`)
- 낙상 순회: 낙상방지 파일의 '원본' 시트(수식이 날짜·요일을 채움) / 청소분담: 최신 분기 시트 + '대청소' 시트 / SCI: 최신 월 시트 / 평가일 관리: POT 통합 파일의 시트 — ExcelJS로 열어 줄만 새로 쓴다
- 합칠 때 rehab-hub의 엑셀 쓰기(SheetJS)로 바꿔야 하는 부분은 위 5개 template/export 파일뿐이다.

## 시험
`npm test` — Node만으로 도는 규칙 시험(직급 정렬 · 새 구역 우선 · CCRT 규칙 · 출근부 서식 · 도구목록 반영).
실제 파일이 필요한 확인은 앱을 띄워 화면에서 합니다.

## 알려 둔 한계
- 출근부 공휴일은 고정일(1/1·3/1·5/5·6/6·8/15·10/3·10/9·12/25)만 자동, 설날·추석·대체·선거일은 직접 입력.
- 신환 평가항목 중 MAS·FAC는 EMR 평가 처방에 없어 환자 구분(뇌손상·MSK·척수손상)으로 채움.
- CCRT는 '10F) CCRT' 스케줄표만 대상(3층은 BETTER/COMCOG만 있어 제외 판정에만 사용).
- 도구 목록 신청서는 형식을 몰라 열 매핑 화면으로 가져옴 — 실제 신청서 형식이 확정되면 자동 인식으로 바꿀 수 있음.

## 디자인 통일 (rehab-hub 파스텔 테마 0.8과 같은 값)
`renderer/shell.css` 맨 아래 "파스텔 테마" 블록이 rehab-hub와 같은 색·면·버튼 값이다. 합칠 때 화면 CSS를 새로 만들 필요 없이 이 블록과 아래 이름만 맞추면 된다.
- 색 변수: `--navy --blue --green --red --orange --bg --border --text --sub --muted` (rehab-hub와 동일 값). 상태 색은 ok=초록 · warn=주황 · err=빨강.
- 상단바·사이드바: 연한 파랑(#e2eafa / #f1f5fd), 켜진 메뉴 = #d8e4fb. 글꼴 = Pretendard Variable(앱에 번들).
- 버튼: 기본 흰색, 주요 = 파스텔 파랑(`.btn.primary`, 이 앱의 `button.pri`도 같은 모양). 선택 묶음(`.seg` `.tabs` `.datebtn` `.chip.on`)의 켜진 상태 = #d8e4fb.
- 카드·표·칩·배지: rehab-hub의 `.card` `table th(#f6f9fd)` `.chip.ok/warn/err/off` `.badge`와 같은 값.
- 설정형 화면(파일 연결): rehab-hub 설정 화면의 `.st-sec` `.st-row` `.st-line` `.st-btns` `.st-fold` 구조를 그대로 썼다.
- 알림(`#msg`)은 rehab-hub `.toast`처럼 위쪽 가운데.
- 이 앱에만 있는 것(합칠 때 옮길 것): `.actionbar`(위 고정 줄) `.exportbar`(아래 고정 내보내기 줄) `.pickpop`(이름 검색 창) `.dropz`(사진 끌어놓기) `table.sheet`(시트 모양 미리보기) `.plan`(배치도).

## 단축키·화면 규칙 (재활프로그램과 같은 규칙)
- Ctrl+1~7 화면 이동 · Ctrl+\ 사이드바 · Ctrl+Enter 실행(다시 배정·만들기, 화면의 `#run` 또는 `data-key="run"`) · Ctrl+E 저장(`#save2`/`#save`/`data-key="save"`) · Ctrl+R 이 화면 새로 읽기 · Alt 길게 = 단축키 카드 · Esc 알림·검색 창 닫기. 눌린 글쇠 자리(`e.code`)로 판별해 한글 입력 상태에서도 된다.
  합칠 때: `shell.js`의 KEYS()를 재활프로그램 GLOBAL_KEYS/VIEW_KEYS 표에 옮기면 된다(화면별 버튼 id만 맞추면 됨).
- 화면은 한 번 만들어 두고 보였다/숨겼다 한다(재활프로그램 `.view` 방식). 파일 연결이 바뀌면 다른 화면은 지워 다음에 새로 읽는다(`Hub.invalidate`).
- 오류는 공통(`Hub.invoke`)에서 알림으로 보여 준다. 저장 끝 안내는 `Hub.saved(경로)` = 파일 이름 + 「폴더 열기」(재활프로그램 저장 안내와 같은 자리).
- 공휴일은 한 곳(`settings.holidays`)에 모은다. 출근부·낙상 화면에서 고친 날짜도 여기에 합쳐진다.
