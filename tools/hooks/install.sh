#!/bin/sh
# 훅 설치 — 저장소를 새 기기에 받은 뒤 1회 실행
cd "$(dirname "$0")/../.." || exit 1
git config core.hooksPath tools/hooks
chmod +x tools/hooks/pre-commit 2>/dev/null
echo "훅 설치 완료: core.hooksPath=tools/hooks"
