# xv6 VFS + HAL 项目开发/测试环境
# 基于 Ubuntu 24.04，预装 RISC-V / LoongArch64 交叉工具链与 QEMU，
# 并预构建好内核和文件系统镜像，容器启动即可 make qemu / 跑测试。
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# 构建与测试依赖（与 AGENTS.md 第 3 节一致）：
#   make/gcc/python3/perl/bc/expect  - 构建系统与测试驱动
#   e2fsprogs                        - mkfs.ext2 / debugfs，制作 ext2 测试镜像
#   gcc-riscv64-unknown-elf          - RISC-V 裸机交叉工具链（src/Makefile 首选）
#   gcc-riscv64-linux-gnu            - RISC-V 备用工具链前缀
#   gcc-14-loongarch64-linux-gnu     - LoongArch64 交叉工具链（src/Makefile 支持 -gcc-14 后缀回退）
#   qemu-system-misc                 - qemu-system-riscv64 / qemu-system-loongarch64（QEMU 8.2 >= 7.2）
#   qemu-system-riscv                - 新版发行版拆分出的 RISC-V 包（存在才装）
#   gdb-multiarch                    - make qemu-gdb 调试
RUN apt-get update && apt-get install -y --no-install-recommends \
    make gcc libc6-dev python3 perl bc expect \
    e2fsprogs \
    gcc-riscv64-unknown-elf gcc-riscv64-linux-gnu \
    gcc-14-loongarch64-linux-gnu \
    qemu-system-misc qemu-utils \
    gdb-multiarch \
    git ca-certificates \
    && (apt-get install -y --no-install-recommends qemu-system-riscv || true) \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /xv6

# 只复制运行所需内容；submit/ 材料、基线副本和构建产物由 .dockerignore 排除
COPY Makefile README.md ./
COPY src/ src/
COPY tests/ tests/

# 预构建：LoongArch64 内核 + 默认 RISC-V 内核与 fs.img（含 ext2/fat32 镜像）。
# 跨架构构建之间 make clean，最终停留在 RISC-V 就绪状态，进容器即可 make qemu。
RUN make -C src clean \
    && make -C src ARCH=loongarch kernel/kernel \
    && make -C src clean \
    && make -C src ARCH=riscv kernel/kernel fs.img

CMD ["bash"]
