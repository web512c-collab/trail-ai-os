# Step-by-Step Build & Test Guide (x86 + x86_64 -> QEMU/VirtualBox)

## 1. Host Prerequisites (Ubuntu / Debian)

Install all required ISO authoring, SquashFS, Syslinux BIOS, dual-arch GRUB2 UEFI (x86_64 + IA32), and kernel build tools:

```bash
sudo apt-get update
sudo apt-get install -y \
  curl xorriso squashfs-tools mmdebstrap \
  isolinux syslinux-common \
  grub-efi-amd64-bin grub-efi-ia32-bin grub-pc-bin \
  dosfstools mtools cpio gzip \
  build-essential bc bison flex libssl-dev libelf-dev
```

---

## 2. Build the Dual-Arch Hybrid ISO (with Optional Custom Kernel)

```bash
chmod +x build_iso.sh setup_compat_layers.sh

# Standard build (remasters initrd with binfmt_misc + binderfs + Wine 10 WoW64 + Plasma Lite):
./build_iso.sh

# Full custom kernel compilation (Linux 6.14+ LTS with built-in =y BinderFS, NTSync, IA32 & binfmt_misc):
BUILD_KERNEL=true ./build_iso.sh
```

---

## 3. Test in QEMU / KVM (x86_64 & 32-bit x86)

### A. x86_64 UEFI Mode (OVMF Firmware + KVM)
```bash
qemu-system-x86_64 \
  -enable-kvm -cpu host -m 2048 -smp 2 \
  -bios /usr/share/ovmf/OVMF.fd \
  -vga virtio -display gtk,gl=on \
  -device virtio-net-pci,netdev=net0 -netdev user,id=net0 \
  -cdrom "./dist/custom-tinycore.iso" \
  -boot d
```

### B. x86_64 Legacy BIOS Mode (KVM)
```bash
qemu-system-x86_64 \
  -enable-kvm -cpu host -m 2048 -smp 2 \
  -vga vmware -display gtk \
  -device e1000,netdev=net0 -netdev user,id=net0 \
  -cdrom "./dist/custom-tinycore.iso" \
  -boot d
```

### C. 32-bit x86 Architecture Verification (QEMU i386)
```bash
qemu-system-i386 \
  -cpu pentium3 -m 1024 -smp 1 \
  -vga std -display gtk \
  -device e1000,netdev=net0 -netdev user,id=net0 \
  -cdrom "./dist/custom-tinycore.iso" \
  -boot d
```

---

## 4. Verify Kernel-Level Wine 10 & Direct APK Support Inside Booted OS

```bash
# Confirm Wine 10+ WoW64 & /dev/ntsync
wine --version
ls -l /dev/ntsync

# Confirm Arabic (ara) + English (us) keyboard layout active in X11
setxkbmap -query
ls -l /usr/share/X11/xkb/symbols/ara

# Confirm kernel binfmt_misc direct execution handlers (MZ & APK)
cat /proc/sys/fs/binfmt_misc/DOSWin
cat /proc/sys/fs/binfmt_misc/AndroidAPK

# Confirm kernel BinderFS for direct Android APK execution
ls -l /dev/binderfs /dev/binder

# Execute a Windows .exe or Android .apk directly from terminal or file manager:
chmod +x ./program.exe ./sample.apk
./program.exe
./sample.apk
```
