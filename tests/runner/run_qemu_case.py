#!/usr/bin/env python3
import argparse
import os
import signal
import subprocess
import sys
import time


def read_commands(path):
    commands = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            commands.append(line)
    return commands


def main():
    parser = argparse.ArgumentParser(description="Run an xv6 QEMU shell test case.")
    parser.add_argument("--case", required=True)
    parser.add_argument("--xv6-dir", required=True)
    parser.add_argument("--commands", required=True)
    parser.add_argument("--log", required=True)
    parser.add_argument("--expect", action="append", default=[])
    parser.add_argument("--reject", action="append", default=[])
    parser.add_argument("--boot-wait", type=float, default=5.0)
    parser.add_argument("--step-wait", type=float, default=1.0)
    parser.add_argument("--final-wait", type=float, default=0.0,
                        help="after the last command, keep draining up to this many "
                             "seconds until all --expect patterns have appeared")
    parser.add_argument("--live", action="store_true",
                        help="mirror QEMU output to the terminal while saving the log")
    args = parser.parse_args()

    commands = read_commands(args.commands)
    os.makedirs(os.path.dirname(args.log), exist_ok=True)

    print(f"== xv6 VFS Test Runner: {args.case} ==", flush=True)
    print(f"[case] commands: {args.commands}", flush=True)
    print(f"[case] raw log:  {args.log}", flush=True)
    arch = os.environ.get("ARCH", "riscv")
    print(f"[case] arch:     {arch}", flush=True)
    print(flush=True)

    qemu = subprocess.Popen(
        ["make", f"ARCH={arch}", "CPUS=1", "qemu"],
        cwd=args.xv6_dir,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,
    )
    os.set_blocking(qemu.stdout.fileno(), False)
    log = bytearray()

    def drain(seconds):
        end = time.time() + seconds
        while time.time() < end:
            try:
                chunk = os.read(qemu.stdout.fileno(), 4096)
                if chunk:
                    log.extend(chunk)
                    if args.live:
                        sys.stdout.buffer.write(chunk)
                        sys.stdout.buffer.flush()
                else:
                    time.sleep(0.05)
            except BlockingIOError:
                time.sleep(0.05)

    def text():
        return log.decode("utf-8", "replace")

    result = "PASS"
    failed_reason = ""

    try:
        drain(args.boot_wait)
        for idx, command in enumerate(commands, 1):
            prefix = "\n" if args.live else ""
            print(f"{prefix}[{idx:02d}/{len(commands):02d}] {command}", flush=True)
            qemu.stdin.write((command + "\n").encode("utf-8"))
            qemu.stdin.flush()
            drain(args.step_wait)
            current = text()
            hit = [pattern for pattern in args.reject if pattern in current]
            if hit:
                result = "FAIL"
                failed_reason = "Rejected output: " + ", ".join(hit)
                break

        drain(0.5)
        if args.final_wait > 0 and result == "PASS":
            end = time.time() + args.final_wait
            while time.time() < end:
                current = text()
                if all(pattern in current for pattern in args.expect):
                    break
                if any(pattern in current for pattern in args.reject):
                    break
                drain(0.5)
        current = text()
        if result == "PASS":
            missing = [pattern for pattern in args.expect if pattern not in current]
            if missing:
                result = "FAIL"
                failed_reason = "Missing expected output: " + ", ".join(missing)
    finally:
        try:
            if qemu.poll() is None and qemu.stdin:
                qemu.stdin.write(b"\x01x")
                qemu.stdin.flush()
                qemu.wait(timeout=1.5)
        except Exception:
            pass
        try:
            if qemu.poll() is None:
                os.killpg(os.getpgid(qemu.pid), signal.SIGTERM)
        except Exception:
            pass
        time.sleep(0.2)
        with open(args.log, "wb") as f:
            f.write(log)

    print()
    for pattern in args.expect:
        marker = "PASS" if pattern in text() else "MISS"
        print(f"[expect:{marker}] {pattern}")
    for pattern in args.reject:
        marker = "OK" if pattern not in text() else "HIT"
        print(f"[reject:{marker}] {pattern}")

    print()
    print(f"Result: {result}")
    if failed_reason:
        print(f"Reason: {failed_reason}")
    print(f"Log: {args.log}")

    return 0 if result == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
