# ot-hub → rehab-hub 합치기 안내

ot-hub는 **프로토타입**입니다. 나중에 rehab-hub(`~/Desktop/rehab-hub`, Electron 31 · 도구 = `renderer/tools/*.html` + `renderer/core/*.js` · 파일은 `window.rehab.folders.*`)에 합칠 때
손볼 곳을 한 군데로 모으도록 구조를 나눠 두었습니다.

## 구조
```
shared/        공용 — dates(날짜) · xl(엑셀 읽기 어댑터) · files(파일 역할) · staff(팀 시트) · status(현황판) · off(주치의 off) · messenger(퇴원)
modules/<id>/  기능 하나 = 폴더 하나
   index.js      IPC 등록 (메인 프로세스)           ← rehab-hub에서는 main/ipc/*.ipc.js 로
   logic/계산 파일  순수 계산(화면·Electron 모름)      ← 그대로 renderer/core 로 옮김
   export/build  결과 엑셀 만들기                     ← 쓰기 방식만 교체
renderer/modules/<id>.js   화면 — Hub.register({id,title,render(root)})   ← 도구 페이지(tools/*.html) 한 장
```

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
- SCI 명단: `sci/sci.js`의 `buildList`
- 출근부: `attendance/build.js`(+`shared/staff.js` 정렬)
- 도구 목록: `inventory/logic.js`의 `match/apply`

## 시험
`npm test` — Node만으로 도는 규칙 시험(직급 정렬 · 새 구역 우선 · CCRT 규칙 · 출근부 서식 · 도구목록 반영).
실제 파일이 필요한 확인은 앱을 띄워 화면에서 합니다.

## 알려 둔 한계
- 출근부 공휴일은 고정일(1/1·3/1·5/5·6/6·8/15·10/3·10/9·12/25)만 자동, 설날·추석·대체·선거일은 직접 입력.
- 신환 평가항목 중 MAS·FAC는 EMR 평가 처방에 없어 환자 구분(뇌손상·MSK·척수손상)으로 채움.
- CCRT는 '10F) CCRT' 스케줄표만 대상(3층은 BETTER/COMCOG만 있어 제외 판정에만 사용).
- 도구 목록 신청서는 형식을 몰라 열 매핑 화면으로 가져옴 — 실제 신청서 형식이 확정되면 자동 인식으로 바꿀 수 있음.
