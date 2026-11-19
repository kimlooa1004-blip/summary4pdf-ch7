#!/bin/sh
# 한 번만 실행: 비밀 차단 pre-commit 훅을 켠다.
cd "$(git rev-parse --show-toplevel)" && cp scripts/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit && echo "pre-commit 훅을 설치했습니다"
