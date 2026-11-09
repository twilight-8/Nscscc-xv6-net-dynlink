"""Run the guest UDP check against a loopback echo server in the QEMU host."""
import argparse
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("arch", choices=("riscv", "loongarch"))
parser.add_argument("log", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
received = set()


def echo(server, stop):
    while not stop.is_set():
        try:
            data, addr = server.recvfrom(64)
        except TimeoutError:
            continue
        if len(data) == 4 and data[:2] == b"XV":
            received.add(int.from_bytes(data[2:], "big"))
            server.sendto(data, addr)


with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as server:
    server.bind(("127.0.0.1", 32123))
    server.settimeout(0.2)
    stop = threading.Event()
    worker = threading.Thread(target=echo, args=(server, stop))
    worker.start()
    try:
        with tempfile.TemporaryDirectory() as temp:
            commands = Path(temp) / "commands"
            commands.write_text("udpcheck\n")
            result = subprocess.run(
                [sys.executable, str(root / "tests/runner/run_qemu_case.py"),
                 "--case", "udpcheck", "--xv6-dir", str(root / "src"),
                 "--commands", str(commands), "--log", str(args.log),
                 "--expect", "UDPCHECK_PASS 24 echoes",
                 "--reject", "UDPCHECK_FAIL", "--reject", "panic:",
                 "--prompt-wait", "--cmd-timeout", "50"],
                env=dict(os.environ, ARCH=args.arch, NET="1"),
            )
    finally:
        stop.set()
        worker.join()
if result.returncode or received != set(range(1, 25)):
    print(f"UDP check failed, host received sequence numbers {sorted(received)}")
    sys.exit(1)
print("Host verified all 24 distinct UDP requests.")
