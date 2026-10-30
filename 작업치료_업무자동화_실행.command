#!/bin/bash
# 작업치료 업무자동화 실행기 — Finder에서 이 파일을 더블클릭하면 됩니다.
# 첫 실행 시 "확인되지 않은 개발자" 경고가 뜨면: 우클릭 → 열기 → 열기 를 한 번만 하세요.

cd "$(dirname "$0")"

# 더블클릭으로 열린 터미널은 ~/.zshrc를 읽지 않으므로 nvm으로 설치한 Node를 직접 불러온다
export NVM_DIR="$HOME/.nvm"
for f in /opt/homebrew/opt/nvm/nvm.sh /usr/local/opt/nvm/nvm.sh "$NVM_DIR/nvm.sh"; do [ -s "$f" ] && { \. "$f"; break; }; done
command -v nvm > /dev/null 2>&1 && { nvm use 22 > /dev/null 2>&1 || nvm use default > /dev/null 2>&1 || true; }
export PATH="$PWD/node_modules/.bin:$PATH"

pause() { echo; echo "아무 키나 누르면 이 창이 닫힙니다."; read -n 1 -s; }

if ! command -v node > /dev/null 2>&1; then echo "[오류] Node.js를 찾을 수 없습니다. 터미널에서 'node -v'가 나오는지 확인해 주세요."; pause; exit 1; fi

# 처음이거나 부품이 없으면 설치
if [ ! -d node_modules/electron ]; then echo "처음 실행이라 필요한 부품을 설치합니다 (몇 분 걸릴 수 있어요)..."; npm install || { echo "[오류] npm install 실패"; pause; exit 1; }; fi

# Electron 본체가 없으면(가끔 사라짐) 다시 받고, 그래도 없으면 재활치료부 통합 시스템의 같은 버전을 빌려 쓴다
APP="node_modules/electron/dist/Electron.app"
if [ ! -d "$APP" ]; then
  echo "Electron 본체를 다시 설치합니다..."; node node_modules/electron/install.js > /dev/null 2>&1
fi
if [ ! -d "$APP" ]; then
  for d in "$HOME/Desktop/rehab-hub/node_modules/electron/dist" "$HOME/Documents/rehab-hub/node_modules/electron/dist"; do
    [ -d "$d/Electron.app" ] && { export ELECTRON_OVERRIDE_DIST_PATH="$d"; echo "재활치료부 통합 시스템의 Electron을 사용합니다: $d"; break; }
  done
fi

echo "작업치료 업무자동화를 실행합니다... (창이 뜰 때까지 몇 초 걸립니다. 실행 중에는 이 창을 닫지 마세요.)"
START=$(date +%s)
node node_modules/electron/cli.js .
CODE=$?
# 10초 안에 비정상 종료(이 폴더의 Electron이 macOS에 막혀 SIGKILL 되는 경우)하면 재활치료부 통합 시스템의 Electron으로 한 번 더 시도
if [ $CODE -ne 0 ] && [ $(( $(date +%s) - START )) -lt 10 ] && [ -z "$ELECTRON_OVERRIDE_DIST_PATH" ]; then
  for d in "$HOME/Desktop/rehab-hub/node_modules/electron/dist" "$HOME/Documents/rehab-hub/node_modules/electron/dist"; do
    if [ -d "$d/Electron.app" ]; then
      echo "이 폴더의 Electron이 실행되지 않아 재활치료부 통합 시스템의 Electron으로 다시 시도합니다: $d"
      ELECTRON_OVERRIDE_DIST_PATH="$d" node node_modules/electron/cli.js .; break
    fi
  done
fi

echo; echo "프로그램이 종료되었습니다."; pause
