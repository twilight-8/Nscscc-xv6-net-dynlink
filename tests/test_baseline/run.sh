#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
XV6_DIR="$ROOT_DIR/xv6-riscv_src"
LOG_DIR="$SCRIPT_DIR/logs"

TEST_LOG="$LOG_DIR/usertests-quick.log"
RESULT_LOG="$LOG_DIR/result.log"

mkdir -p "$LOG_DIR"

if [ ! -f "$XV6_DIR/fs.img" ]; then
  echo "[test_baseline] fs.img not found"
  echo "Use: make test_baseline"
  exit 1
fi

echo "[test_baseline] running usertests -q"
(
  cd "$XV6_DIR" || exit 1
  python3 test-xv6.py usertests -q
) > "$TEST_LOG" 2>&1
test_status=$?

if [ "$test_status" -eq 0 ] && grep -q "ALL TESTS PASSED" "$TEST_LOG"; then
  result="PASS"
else
  result="FAIL"
fi

{
  echo "Result: $result"
  echo "Test Status: $test_status"
  echo "Test Log: $TEST_LOG"
} > "$RESULT_LOG"

echo "[test_baseline] result: $result"
echo "[test_baseline] logs: $LOG_DIR"

if [ "$result" != "PASS" ]; then
  exit 1
fi
