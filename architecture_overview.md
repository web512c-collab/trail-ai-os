# CorePure64 Hybrid OS (Dual x86 (32-bit) + x86_64 (64-bit) Hybrid) — Architecture Overview

## 1. Design Philosophy & Footprint Summary

This build environment targets **Tiny Core Linux 15.x** across **Dual x86 (32-bit) + x86_64 (64-bit) Hybrid** hardware, preserving Tiny Core's loop-mounted SquashFS architecture while embedding **Wine 10+ WoW64**, direct **Android APK** execution, and **KDE Plasma Lite + Openbox** directly into the core image and kernel layer.

| Component Layer | Storage Footprint (ISO) | RAM Impact (Idle) | Mount / Integration Strategy |
| :--- | ---: | ---: | :--- |
| Kernel (`vmlinuz64` / `vmlinuz`) + Initrd | 42 MB | ~48 MB | Built-in `binderfs`, `ntsync`, `binfmt_misc`, `IA32_EMULATION` |
| Xorg + GPU Drivers + KDE Plasma Lite + Openbox Fallback | 309 MB | ~292 MB | Loop-mounted SquashFS (`/tmp/tcloop`) |
| Utilities, Browser (`falkon`), Wi-Fi, Bash/DBus | 116 MB | ~25 MB | Loop-mounted SquashFS (`/tmp/tcloop`) |
| Windows Layer (**Wine 10+ WoW64** + Winetricks) | 217 MB | Embedded in core + /dev/ntsync | Baked into core SquashFS + kernel `binfmt_misc` |
| Android Runtime (waydroid-cage) | 485 MB | 0 MB until APK launch | Kernel `binderfs` + SquashFS + OverlayFS |
| **Total Hybrid ISO (BIOS + UEFI)** | **~1289 MB** | **~352 MB Idle** | Hybrid ISO9660 + GPT/MBR |

---

## 2. Dual x86 + x86_64 Boot & Kernel-Level Integration

1. **Dual-Architecture ISO Layout (`x86` + `x86_64`)**:
   - **64-bit path**: `/boot/vmlinuz64` + `/boot/corepure64.gz` + `/cde/`
   - **32-bit x86 path**: `/boot/vmlinuz` + `/boot/core.gz` + `/cde32/`
   - **UEFI**: `boot/grub/efi.img` embeds both `EFI/BOOT/BOOTX64.EFI` (64-bit UEFI) and `EFI/BOOT/BOOTIA32.EFI` (32-bit IA32 UEFI). GRUB2 runs `cpuid -l` at boot to auto-select 64-bit or 32-bit kernels automatically!
   - **BIOS**: ISOLINUX uses `ifcpu64.c32` (when available) or menu entries `live64` / `live32`.
2. **Kernel-Level Wine 10+ & Android Integration (`kernel_configs/corepure64-android-wine.config`)**:
   - **`CONFIG_BINFMT_MISC=y`**: Kernel `execve()` intercepts Windows PE (`MZ`) magic bytes and `.apk` files directly via `/proc/sys/fs/binfmt_misc`, allowing users to run `./program.exe` or `./app.apk` straight from any terminal as well as double-clicking in Dolphin/PCManFM.
   - **`CONFIG_NTSYNC=y` + `CONFIG_IA32_EMULATION=y`**: Enables Wine 10+ native `/dev/ntsync` synchronization primitives and 32-bit WoW64 Windows compatibility directly inside the x86_64 kernel.
   - **`CONFIG_ANDROID_BINDER_IPC=y` + `CONFIG_ANDROID_BINDERFS=y`**: Mounts `/dev/binderfs` at boot in `/opt/bootlocal.sh` and exposes `/dev/binder`, `/dev/hwbinder`, and `/dev/vndbinder` directly for **Waydroid + Cage (Nested Wayland Compositor in X11)** without relying on external out-of-tree kernel modules.
3. **Arabic Keyboard Layout & Unicode Rendering**:
   - **X11 XKB**: Configured globally via `/etc/X11/xorg.conf.d/00-keyboard.conf` (`XkbLayout="us,ara"`, `XkbOptions="grp:alt_shift_toggle"`) with `setxkbmap.tcz` + `xkeyboard-config.tcz`.
   - **KDE Plasma Lite & Openbox**: `ui_configs/kde-plasma/kxkbrc` enables the EN/AR tray indicator, while Openbox `autostart` applies `setxkbmap` at login and `fonts-noto-core` ensures crisp Arabic glyph shaping.
