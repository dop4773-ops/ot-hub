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
