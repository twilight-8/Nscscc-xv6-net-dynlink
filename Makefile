SHELL := /bin/bash

XV6_DIR := src
STATE_FILE := .last-test

.PHONY: test_baseline test_public_vfs run

test_baseline:
	@set -eu; \
	TEST_NAME="test_baseline"; \
	TEST_DIR="tests/$$TEST_NAME"; \
	LOG_DIR="$$TEST_DIR/logs"; \
	mkdir -p "$$LOG_DIR"; \
	echo "[test_baseline] record environment"; \
	{ \
		echo "Test Name: $$TEST_NAME"; \
		echo "Date: $$(date -Iseconds)"; \
		echo "Target: xv6-riscv rev5 baseline"; \
		echo "Platform: RISC-V"; \
		echo; \
		echo "== Host =="; \
		uname -a; \
		echo; \
		echo "== OS =="; \
		cat /etc/os-release 2>/dev/null || true; \
		echo; \
		echo "== Tools =="; \
		python3 --version 2>&1 || true; \
		make --version 2>&1 | head -n 1 || true; \
		qemu-system-riscv64 --version 2>&1 | head -n 1 || true; \
		riscv64-unknown-elf-gcc --version 2>&1 | head -n 1 || true; \
		riscv64-unknown-elf-ld --version 2>&1 | head -n 1 || true; \
		echo; \
		echo "== Git =="; \
		git rev-parse --short HEAD 2>/dev/null || echo "unknown"; \
		git status --short 2>/dev/null || true; \
	} > "$$LOG_DIR/env.log" 2>&1; \
	echo "[test_baseline] build xv6 fs image"; \
	( \
		cd "$(XV6_DIR)" && \
		make clean && \
		make kernel/kernel && \
		make fs.img \
	) > "$$LOG_DIR/build.log" 2>&1; \
	printf "%s\n" "$$TEST_NAME" > "$(STATE_FILE)"; \
	echo "[test_baseline] prepare done"; \
	echo "Next command: make run"

test_public_vfs:
	@set -eu; \
	TEST_NAME="public_vfs"; \
	TEST_DIR="tests/$$TEST_NAME"; \
	LOG_DIR="$$TEST_DIR/logs"; \
	mkdir -p "$$LOG_DIR"; \
	echo "[public_vfs] record environment"; \
	{ \
		echo "Test Name: $$TEST_NAME"; \
		echo "Date: $$(date -Iseconds)"; \
		echo "Target: public VFS ext2 cross-filesystem tests"; \
		echo "Platform: RISC-V"; \
		echo; \
		echo "== Host =="; \
		uname -a; \
		echo; \
		echo "== Tools =="; \
		python3 --version 2>&1 || true; \
		make --version 2>&1 | head -n 1 || true; \
		qemu-system-riscv64 --version 2>&1 | head -n 1 || true; \
		riscv64-unknown-elf-gcc --version 2>&1 | head -n 1 || true; \
		echo; \
		echo "== Git =="; \
		git rev-parse --short HEAD 2>/dev/null || echo "unknown"; \
		git status --short 2>/dev/null || true; \
	} > "$$LOG_DIR/env.log" 2>&1; \
	echo "[public_vfs] build xv6 fs image"; \
	( \
		cd "$(XV6_DIR)" && \
		make clean && \
		make kernel/kernel && \
		rm -f fs.img ext2.img fat32.img && \
		make fs.img \
	) > "$$LOG_DIR/build.log" 2>&1; \
	printf "%s\n" "$$TEST_NAME" > "$(STATE_FILE)"; \
	echo "[public_vfs] prepare done"; \
	echo "Next command: make run"

run:
	@set -eu; \
	if [ ! -f "$(STATE_FILE)" ]; then \
		echo "No prepared test."; \
		echo "Use: make test_baseline or make test_public_vfs"; \
		exit 1; \
	fi; \
	TEST_NAME="$$(cat "$(STATE_FILE)")"; \
	case "$$TEST_NAME" in \
		test_baseline) bash "tests/test_baseline/run.sh" ;; \
		public_vfs) bash "tests/public_vfs/run.sh" ;; \
		*) echo "Unknown prepared test: $$TEST_NAME"; exit 1 ;; \
	esac
