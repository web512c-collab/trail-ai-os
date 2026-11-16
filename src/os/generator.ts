import {
  GeneratedArtifact,
  OsBuildConfig,
  ResourceEstimate,
  TczPackageSpec,
  ValidationIssue,
} from './types';

export function validateBuildConfig(config: OsBuildConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!/^[A-Z0-9_]{1,32}$/.test(config.volumeId)) {
    issues.push({
      field: 'volumeId',
      message: 'Volume ID must be 1-32 uppercase alphanumeric or underscore characters.',
    });
  }

  if (!/^[a-zA-Z0-9._-]+\.iso$/.test(config.isoName)) {
    issues.push({
      field: 'isoName',
      message: 'Output ISO filename must use safe characters and end with .iso.',
    });
  }

  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(config.hostname)) {
    issues.push({
      field: 'hostname',
      message: 'Hostname must be lowercase alphanumeric/hyphen (RFC-1123).',
    });
  }

  if (!/^[A-Z0-9_]{1,16}$/.test(config.persistenceLabel)) {
    issues.push({
      field: 'persistenceLabel',
      message: 'Persistence label must be 1-16 uppercase alphanumeric or underscore chars.',
    });
  }

  return issues;
}

export function resolveXkbLayout(config: OsBuildConfig): {
  layout: string;
  variant: string;
  names: string;
  toggleLabel: string;
} {
  const toggleLabel =
    config.keyboardToggle === 'grp:alt_shift_toggle'
      ? 'Alt+Shift'
      : config.keyboardToggle === 'grp:ctrl_shift_toggle'
      ? 'Ctrl+Shift'
      : 'Super+Space';

  if (config.keyboardLayout === 'ara-us') {
    return { layout: 'ara,us', variant: ',', names: 'AR,EN', toggleLabel };
  }
  if (config.keyboardLayout === 'us') {
    return { layout: 'us', variant: '', names: 'EN', toggleLabel };
  }
  return { layout: 'us,ara', variant: ',', names: 'EN,AR', toggleLabel };
}

export function getPackageManifest(config: OsBuildConfig): TczPackageSpec[] {
  const includesPlasma =
    config.desktopEnvironment === 'kde-plasma-lite' ||
    config.desktopEnvironment === 'dual-plasma-openbox';
  const includesOpenbox =
    config.desktopEnvironment === 'openbox-tint2' ||
    config.desktopEnvironment === 'dual-plasma-openbox';
  const compatMode: TczPackageSpec['loadMode'] = config.embedCompatInCore
    ? 'initrd-core'
    : config.wineOnDemand
    ? 'ondemand'
    : 'onboot';

  const browserPkg: Record<OsBuildConfig['browser'], { name: string; sizeMb: number; purpose: string }> = {
    falkon: { name: 'falkon.tcz', sizeMb: 42, purpose: 'Lightweight QtWebEngine web browser (native KDE/Qt integration)' },
    'firefox-esr': { name: 'firefox_ESR.tcz', sizeMb: 78, purpose: 'Firefox Extended Support Release browser' },
    midori: { name: 'midori.tcz', sizeMb: 28, purpose: 'Minimal WebKitGTK web browser' },
  };

  const termPkg: Record<OsBuildConfig['terminal'], { name: string; sizeMb: number; purpose: string }> = {
    konsole: { name: 'konsole-lite.tcz', sizeMb: 8, purpose: 'KDE Plasma tabbed terminal emulator' },
    lxterminal: { name: 'lxterminal.tcz', sizeMb: 4, purpose: 'Ultra-lightweight VTE terminal emulator' },
    alacritty: { name: 'alacritty.tcz', sizeMb: 12, purpose: 'GPU-accelerated Rust terminal emulator' },
  };

  const fmPkg: Record<OsBuildConfig['fileManager'], { name: string; sizeMb: number; purpose: string }> = {
    dolphin: { name: 'dolphin-lite.tcz', sizeMb: 12, purpose: 'KDE Plasma fast split-pane file manager' },
    pcmanfm: { name: 'pcmanfm.tcz', sizeMb: 6, purpose: 'Fast GTK file manager with GVFS & desktop MIME support' },
    thunar: { name: 'thunar.tcz', sizeMb: 11, purpose: 'Modern XFCE file manager with custom actions' },
  };

  const pkgs: TczPackageSpec[] = [];

  if (config.kernelIntegration) {
    pkgs.push(
      { name: 'kernel-binderfs-ashmem (built-in =y)', layer: 'kernel-core', loadMode: 'kernel-builtin', sizeMb: 0, purpose: 'Linux kernel Android Binder IPC, binderfs, and memfd/ashmem support compiled into vmlinuz' },
      { name: 'kernel-ntsync-ia32 (built-in =y)', layer: 'kernel-core', loadMode: 'kernel-builtin', sizeMb: 0, purpose: 'Wine 10+ /dev/ntsync fast NT synchronization + CONFIG_IA32_EMULATION=y for 32/64-bit PE binaries' },
      { name: 'kernel-binfmt-misc (built-in =y)', layer: 'kernel-core', loadMode: 'kernel-builtin', sizeMb: 0, purpose: 'Kernel binfmt_misc direct execve() dispatch for MZ (.exe) and .apk files' }
    );
  }

  if (config.targetArch === 'dual-x86-x86_64' || config.targetArch === 'x86') {
    pkgs.push({
      name: 'core-x86-32bit-payload (vmlinuz + core.gz + cde32)',
      layer: 'kernel-core',
      loadMode: 'initrd-core',
      sizeMb: 96,
      purpose: '32-bit x86 i686 kernel, initrd & core desktop stack auto-selected on non-64-bit CPUs',
    });
  }

  pkgs.push(
    // Mandatory Base Shell, D-Bus & X11 Core (guarantees GUI startup)
    { name: 'bash.tcz', layer: 'utilities', loadMode: 'onboot', sizeMb: 2, purpose: 'GNU Bash shell for build/compat scripts (replaces BusyBox ash limits)' },
    { name: 'dbus.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 2, purpose: 'D-Bus system & session bus required by Plasma, PulseAudio, NM & Waydroid' },
    { name: 'Xorg-7.7.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 18, purpose: 'X.Org display server & core RandR/XInput stack' },
    { name: 'Xprogs.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 3, purpose: 'Tiny Core X11 session utilities & startx wrapper' },
    { name: 'Xlibs.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 4, purpose: 'Shared X11 runtime libraries' },
    { name: 'xf86-video-intel.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 3, purpose: 'Intel integrated GPU KMS/DRI driver' },
    { name: 'xf86-video-amdgpu.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 2, purpose: 'AMD Radeon / AMDGPU display driver' },
    { name: 'xf86-video-vmware.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 2, purpose: 'VMware / VirtualBox VMSVGA acceleration driver' },
    { name: 'xf86-video-fbdev.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 1, purpose: 'Universal UEFI GOP / framebuffer fallback driver' },
    { name: 'xf86-video-vesa.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 1, purpose: 'Legacy BIOS VESA safe-graphics fallback driver' },
    { name: 'xf86-input-libinput.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 1, purpose: 'Unified touchpad, mouse, and keyboard input' },
    { name: 'setxkbmap.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 1, purpose: 'X11 runtime keyboard layout switcher (English us + Arabic ara)' },
    { name: 'xkeyboard-config.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 2, purpose: 'XKB keyboard definitions including /usr/share/X11/xkb/symbols/ara' },
    { name: 'mesa-dri.tcz', layer: 'graphics', loadMode: 'onboot', sizeMb: 24, purpose: 'OpenGL / Mesa DRI hardware acceleration for KWin & X11' }
  );

  if (includesPlasma) {
    pkgs.push(
      { name: 'kde-plasma-lite.tcz', layer: 'base-ui', loadMode: 'onboot', sizeMb: 185, purpose: 'Stripped KDE Plasma Lite (KWin-X11, Plasma Shell, KRunner, Breeze, zero Baloo/Akonadi)' },
      { name: 'breeze-icons.tcz', layer: 'base-ui', loadMode: 'onboot', sizeMb: 14, purpose: 'KDE Breeze SVG vector icon theme' }
    );
  }

  if (includesOpenbox) {
    pkgs.push(
      { name: 'openbox.tcz', layer: 'base-ui', loadMode: 'onboot', sizeMb: 2, purpose: 'Standards-compliant stacking window manager (fallback / ultra-low RAM session)' },
      { name: 'tint2.tcz', layer: 'base-ui', loadMode: 'onboot', sizeMb: 2, purpose: 'Lightweight taskbar, clock, and X11 system tray' },
      { name: 'rofi.tcz', layer: 'base-ui', loadMode: 'onboot', sizeMb: 3, purpose: 'Keyboard-driven application & command launcher' },
      { name: 'feh.tcz', layer: 'base-ui', loadMode: 'onboot', sizeMb: 2, purpose: 'Minimalist X11 wallpaper setter & image viewer' },
      { name: 'papirus-icon-theme.tcz', layer: 'base-ui', loadMode: 'onboot', sizeMb: 16, purpose: 'Modern crisp vector icon theme' }
    );
  }

  pkgs.push(
    { name: 'dejavu-fonts-ttf.tcz', layer: 'base-ui', loadMode: 'onboot', sizeMb: 6, purpose: 'Crisp sans and monospace system fonts' },
    ...(config.keyboardLayout !== 'us'
      ? [{ name: 'noto-fonts-arabic.tcz', layer: 'base-ui' as const, loadMode: 'onboot' as const, sizeMb: 4, purpose: 'Arabic Unicode TrueType shaping fonts (Noto Sans/Naskh Arabic)' }]
      : []),
    { name: 'pulseaudio.tcz', layer: 'base-ui', loadMode: 'onboot', sizeMb: 7, purpose: 'Audio routing server & volume control' },
    { name: 'volumeicon.tcz', layer: 'base-ui', loadMode: 'onboot', sizeMb: 1, purpose: 'System tray volume mixer applet' },
    { name: 'custom-ui-overlay.tcz', layer: 'base-ui', loadMode: 'onboot', sizeMb: 4, purpose: 'Plasma Lite + Openbox configs, 00-keyboard.conf (Arabic XKB), binfmt_misc & MIME runners' },

    // Essential Utilities & MIME toolchain
    { name: fmPkg[config.fileManager].name, layer: 'utilities', loadMode: 'onboot', sizeMb: fmPkg[config.fileManager].sizeMb, purpose: fmPkg[config.fileManager].purpose },
    { name: browserPkg[config.browser].name, layer: 'utilities', loadMode: 'onboot', sizeMb: browserPkg[config.browser].sizeMb, purpose: browserPkg[config.browser].purpose },
    { name: termPkg[config.terminal].name, layer: 'utilities', loadMode: 'onboot', sizeMb: termPkg[config.terminal].sizeMb, purpose: termPkg[config.terminal].purpose },
    { name: 'leafpad.tcz', layer: 'utilities', loadMode: 'onboot', sizeMb: 1, purpose: 'Fast graphical text editor' },
    { name: 'htop.tcz', layer: 'utilities', loadMode: 'onboot', sizeMb: 1, purpose: 'Interactive CPU/memory process monitor' },
    { name: 'unzip.tcz', layer: 'utilities', loadMode: 'onboot', sizeMb: 1, purpose: 'ZIP archive extraction utility' },
    { name: 'p7zip.tcz', layer: 'utilities', loadMode: 'onboot', sizeMb: 3, purpose: '7z / LZMA archive support for file manager' },
    { name: 'tar.tcz', layer: 'utilities', loadMode: 'onboot', sizeMb: 1, purpose: 'GNU tar archive utility' },
    { name: 'shared-mime-info.tcz', layer: 'utilities', loadMode: 'onboot', sizeMb: 2, purpose: 'XDG MIME database for .exe, .msi & .apk double-click associations' },
    { name: 'desktop-file-utils.tcz', layer: 'utilities', loadMode: 'onboot', sizeMb: 1, purpose: 'update-desktop-database utility for .desktop MIME cache' },
    { name: 'zenity.tcz', layer: 'utilities', loadMode: 'onboot', sizeMb: 2, purpose: 'Lightweight GUI progress & error dialogs for APK/EXE wrappers' }
  );

  if (config.includeWifiFirmware) {
    pkgs.push(
      { name: 'wifi.tcz', layer: 'network', loadMode: 'onboot', sizeMb: 2, purpose: 'Tiny Core wireless connection manager & wpa_supplicant' },
      { name: 'network-manager-applet.tcz', layer: 'network', loadMode: 'onboot', sizeMb: 5, purpose: 'System tray Wi-Fi & Ethernet applet' },
      { name: 'firmware-iwlwifi.tcz', layer: 'network', loadMode: 'onboot', sizeMb: 18, purpose: 'Intel Wireless Wi-Fi 6 / AX firmware blobs' },
      { name: 'firmware-atheros.tcz', layer: 'network', loadMode: 'onboot', sizeMb: 9, purpose: 'Qualcomm Atheros wireless firmware' },
      { name: 'firmware-rtlwifi.tcz', layer: 'network', loadMode: 'onboot', sizeMb: 6, purpose: 'Realtek RTL8xxx wireless firmware' }
    );
  }

  if (config.includeWine) {
    const winePkgName =
      config.wineVersion === 'wine-10-staging' ? 'wine10-staging-wow64.tcz' : 'wine10-wow64.tcz';
    pkgs.push(
      {
        name: winePkgName,
        layer: 'compat-wine',
        loadMode: compatMode,
        sizeMb: 215,
        purpose: 'Wine 10.x WoW64 (runs 32-bit x86 & 64-bit x86_64 Windows .exe/.msi with /dev/ntsync)',
      },
      {
        name: 'winetricks.tcz',
        layer: 'compat-wine',
        loadMode: compatMode,
        sizeMb: 2,
        purpose: 'Automated DLL & runtime installer for Wine 10 prefixes',
      }
    );
  }

  if (config.androidRuntime === 'waydroid-cage') {
    pkgs.push(
      { name: 'cage.tcz', layer: 'compat-android', loadMode: config.embedCompatInCore ? 'initrd-core' : 'onboot', sizeMb: 3, purpose: 'Single-window Wayland kiosk compositor nested inside X11' },
      { name: 'lxc.tcz', layer: 'compat-android', loadMode: config.embedCompatInCore ? 'initrd-core' : 'onboot', sizeMb: 8, purpose: 'Linux Container runtime for isolated Android user-space' },
      { name: 'waydroid.tcz', layer: 'compat-android', loadMode: config.embedCompatInCore ? 'initrd-core' : 'optional-sfs', sizeMb: 14, purpose: 'Containerized Android runtime & direct APK intent bridge' },
      { name: 'android-lineage-squashfs.sfs', layer: 'compat-android', loadMode: 'optional-sfs', sizeMb: 460, purpose: 'Compressed Android system+vendor SquashFS images (x86/x86_64 native ABI)' }
    );
  } else {
    pkgs.push(
      { name: 'qemu-kvm.tcz', layer: 'compat-android', loadMode: config.embedCompatInCore ? 'initrd-core' : 'ondemand', sizeMb: 24, purpose: 'Lightweight QEMU-KVM virtualization engine for Android micro-VM' },
      { name: 'android-tools.tcz', layer: 'compat-android', loadMode: config.embedCompatInCore ? 'initrd-core' : 'onboot', sizeMb: 5, purpose: 'Android Debug Bridge (adb) for one-click APK installation' },
      { name: 'android-x86-micro.img.zst', layer: 'compat-android', loadMode: 'optional-sfs', sizeMb: 390, purpose: 'Compressed Android-x86 micro-VM disk image booted on demand' }
    );
  }

  return pkgs;
}

export function calculateResourceEstimate(config: OsBuildConfig): ResourceEstimate {
  const manifest = getPackageManifest(config);
  const baseInitrdMb = config.targetArch === 'dual-x86-x86_64' ? 42 : 24;

  const sumLayer = (layer: TczPackageSpec['layer']) =>
    manifest.filter((p) => p.layer === layer).reduce((acc, p) => acc + p.sizeMb, 0);

  const coreArchMb = sumLayer('kernel-core');
  const xorgUiMb = sumLayer('graphics') + sumLayer('base-ui');
  const utilitiesMb = sumLayer('utilities') + sumLayer('network');
  const wineSquashfsMb = sumLayer('compat-wine');
  const androidImageMb = sumLayer('compat-android');

  const bootloaderOverheadMb = config.targetArch === 'dual-x86-x86_64' ? 24 : 18;
  const totalIsoMb =
    baseInitrdMb +
    coreArchMb +
    xorgUiMb +
    utilitiesMb +
    wineSquashfsMb +
    androidImageMb +
    bootloaderOverheadMb;

  const includesPlasma =
    config.desktopEnvironment === 'kde-plasma-lite' ||
    config.desktopEnvironment === 'dual-plasma-openbox';

  const baseUiRam = includesPlasma ? 310 : 165;
  const embedOverhead = config.embedCompatInCore ? 28 : 0;
  const idleRamMb =
    baseUiRam +
    embedOverhead +
    (config.includeWifiFirmware ? 14 : 0) +
    (config.terminal === 'alacritty' ? 8 : 0);
  const wineActiveRamMb = config.includeWine ? idleRamMb + 145 : idleRamMb;
  const androidActiveRamMb =
    idleRamMb + (config.androidRuntime === 'waydroid-cage' ? 420 : 680);

  return {
    baseInitrdMb,
    xorgUiMb,
    utilitiesMb,
    wineSquashfsMb,
    androidImageMb,
    totalIsoMb,
    idleRamMb,
    wineActiveRamMb,
    androidActiveRamMb,
    extensionCount: manifest.length,
  };
}

export function buildXorissoCommand(config: OsBuildConfig): string {
  return [
    'xorriso -as mkisofs \\',
    '  -iso-level 3 \\',
    '  -full-iso9660-filenames \\',
    `  -volid "${config.volumeId}" \\`,
    '  -c boot/isolinux/boot.cat \\',
    '  -b boot/isolinux/isolinux.bin \\',
    '  -no-emul-boot \\',
    '  -boot-load-size 4 \\',
    '  -boot-info-table \\',
    '  -isohybrid-mbr "${ISOHDPFX_BIN}" \\',
    '  -eltorito-alt-boot \\',
    '  -e boot/grub/efi.img \\',
    '  -no-emul-boot \\',
    '  -isohybrid-gpt-basdat \\',
    `  -output "\${OUTPUT_DIR}/${config.isoName}" \\`,
    '  "${ISO_ROOT}"',
  ].join('\n');
}

function generateKernelConfigFragment(config: OsBuildConfig): string {
  return `# ==============================================================================
# Linux Kernel 6.14+ LTS Config Fragment — CorePure64 + x86 Dual-Arch
# Integrates Wine 10+ (/dev/ntsync + IA32_EMULATION), Android (Binder/BinderFS),
# and binfmt_misc direct binary execution directly into the kernel (=y).
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Dual x86 / x86_64 Execution & Wine 10+ WoW64 Support
# ------------------------------------------------------------------------------
CONFIG_64BIT=${config.targetArch === 'x86' ? 'n' : 'y'}
CONFIG_IA32_EMULATION=y
CONFIG_X86_X32_ABI=y
CONFIG_COMPAT=y
CONFIG_BINFMT_ELF=y
CONFIG_COMPAT_BINFMT_ELF=y
CONFIG_BINFMT_MISC=y
CONFIG_NTSYNC=y
CONFIG_USER_NS=y
CONFIG_SYSVIPC=y
CONFIG_POSIX_MQUEUE=y

# ------------------------------------------------------------------------------
# 2. Direct Android Container & APK Execution (Built-in =y)
# ------------------------------------------------------------------------------
CONFIG_ANDROID=y
CONFIG_ANDROID_BINDER_IPC=y
CONFIG_ANDROID_BINDERFS=y
CONFIG_ANDROID_BINDER_DEVICES="binder,hwbinder,vndbinder"
CONFIG_MEMFD_CREATE=y
CONFIG_PSI=y
CONFIG_STAGING=y

# ------------------------------------------------------------------------------
# 3. Namespaces, Cgroups, SquashFS & OverlayFS
# ------------------------------------------------------------------------------
CONFIG_NAMESPACES=y
CONFIG_UTS_NS=y
CONFIG_IPC_NS=y
CONFIG_PID_NS=y
CONFIG_NET_NS=y
CONFIG_CGROUPS=y
CONFIG_CGROUP_FREEZER=y
CONFIG_CGROUP_PIDS=y
CONFIG_CGROUP_CPUACCT=y
CONFIG_MEMCG=y
CONFIG_OVERLAY_FS=y
CONFIG_SQUASHFS=y
CONFIG_SQUASHFS_XZ=y
CONFIG_SQUASHFS_ZSTD=y
CONFIG_TMPFS=y
CONFIG_TMPFS_XATTR=y

# ------------------------------------------------------------------------------
# 4. Virtualization, Networking & Graphics
# ------------------------------------------------------------------------------
CONFIG_KVM=y
CONFIG_KVM_INTEL=m
CONFIG_KVM_AMD=m
CONFIG_TUN=y
CONFIG_VETH=y
CONFIG_BRIDGE=y
CONFIG_DRM=y
CONFIG_DRM_FBDEV_EMULATION=y
CONFIG_DRM_VIRTIO_GPU=y
`;
}

function generateArchitectureOverview(config: OsBuildConfig, estimate: ResourceEstimate): string {
  const androidLabel =
    config.androidRuntime === 'waydroid-cage'
      ? 'Waydroid + Cage (Nested Wayland Compositor in X11)'
      : 'QEMU-KVM Micro-VM + ADB Bridge';
  const deLabel =
    config.desktopEnvironment === 'dual-plasma-openbox'
      ? 'KDE Plasma Lite + Openbox Fallback'
      : config.desktopEnvironment === 'kde-plasma-lite'
      ? 'KDE Plasma Lite (KWin + Plasma Shell + Breeze)'
      : 'Openbox + Tint2 + Rofi';
  const archLabel =
    config.targetArch === 'dual-x86-x86_64'
      ? 'Dual x86 (32-bit) + x86_64 (64-bit) Hybrid'
      : config.targetArch;

  return `# CorePure64 Hybrid OS (${archLabel}) — Architecture Overview

## 1. Design Philosophy & Footprint Summary

This build environment targets **Tiny Core Linux ${config.tcVersion}** across **${archLabel}** hardware, preserving Tiny Core's loop-mounted SquashFS architecture while embedding **Wine 10+ WoW64**, direct **Android APK** execution, and **KDE Plasma Lite + Openbox** directly into the core image and kernel layer.

| Component Layer | Storage Footprint (ISO) | RAM Impact (Idle) | Mount / Integration Strategy |
| :--- | ---: | ---: | :--- |
| Kernel (\`vmlinuz64\` / \`vmlinuz\`) + Initrd | ${estimate.baseInitrdMb} MB | ~48 MB | Built-in \`binderfs\`, \`ntsync\`, \`binfmt_misc\`, \`IA32_EMULATION\` |
| Xorg + GPU Drivers + ${deLabel} | ${estimate.xorgUiMb} MB | ~${estimate.idleRamMb - 60} MB | Loop-mounted SquashFS (\`/tmp/tcloop\`) |
| Utilities, Browser (\`${config.browser}\`), Wi-Fi, Bash/DBus | ${estimate.utilitiesMb} MB | ~25 MB | Loop-mounted SquashFS (\`/tmp/tcloop\`) |
| Windows Layer (**Wine 10+ WoW64** + Winetricks) | ${estimate.wineSquashfsMb} MB | ${config.embedCompatInCore ? 'Embedded in core + /dev/ntsync' : config.wineOnDemand ? '0 MB until .exe launch' : '~12 MB symlink overhead'} | ${config.embedCompatInCore ? 'Baked into core SquashFS + kernel \`binfmt_misc\`' : 'Loop-mounted SquashFS'} |
| Android Runtime (${config.androidRuntime}) | ${estimate.androidImageMb} MB | 0 MB until APK launch | Kernel \`binderfs\` + SquashFS + OverlayFS |
| **Total Hybrid ISO (BIOS + UEFI)** | **~${estimate.totalIsoMb} MB** | **~${estimate.idleRamMb} MB Idle** | Hybrid ISO9660 + GPT/MBR |

---

## 2. Dual x86 + x86_64 Boot & Kernel-Level Integration

1. **Dual-Architecture ISO Layout (\`x86\` + \`x86_64\`)**:
   - **64-bit path**: \`/boot/vmlinuz64\` + \`/boot/corepure64.gz\` + \`/cde/\`
   - **32-bit x86 path**: \`/boot/vmlinuz\` + \`/boot/core.gz\` + \`/cde32/\`
   - **UEFI**: \`boot/grub/efi.img\` embeds both \`EFI/BOOT/BOOTX64.EFI\` (64-bit UEFI) and \`EFI/BOOT/BOOTIA32.EFI\` (32-bit IA32 UEFI). GRUB2 runs \`cpuid -l\` at boot to auto-select 64-bit or 32-bit kernels automatically!
   - **BIOS**: ISOLINUX uses \`ifcpu64.c32\` (when available) or menu entries \`live64\` / \`live32\`.
2. **Kernel-Level Wine 10+ & Android Integration (\`kernel_configs/corepure64-android-wine.config\`)**:
   - **\`CONFIG_BINFMT_MISC=y\`**: Kernel \`execve()\` intercepts Windows PE (\`MZ\`) magic bytes and \`.apk\` files directly via \`/proc/sys/fs/binfmt_misc\`, allowing users to run \`./program.exe\` or \`./app.apk\` straight from any terminal as well as double-clicking in Dolphin/PCManFM.
   - **\`CONFIG_NTSYNC=y\` + \`CONFIG_IA32_EMULATION=y\`**: Enables Wine 10+ native \`/dev/ntsync\` synchronization primitives and 32-bit WoW64 Windows compatibility directly inside the x86_64 kernel.
   - **\`CONFIG_ANDROID_BINDER_IPC=y\` + \`CONFIG_ANDROID_BINDERFS=y\`**: Mounts \`/dev/binderfs\` at boot in \`/opt/bootlocal.sh\` and exposes \`/dev/binder\`, \`/dev/hwbinder\`, and \`/dev/vndbinder\` directly for **${androidLabel}** without relying on external out-of-tree kernel modules.
3. **Arabic Keyboard Layout & Unicode Rendering**:
   - **X11 XKB**: Configured globally via \`/etc/X11/xorg.conf.d/00-keyboard.conf\` (\`XkbLayout="${resolveXkbLayout(config).layout}"\`, \`XkbOptions="${config.keyboardToggle}"\`) with \`setxkbmap.tcz\` + \`xkeyboard-config.tcz\`.
   - **KDE Plasma Lite & Openbox**: \`ui_configs/kde-plasma/kxkbrc\` enables the EN/AR tray indicator, while Openbox \`autostart\` applies \`setxkbmap\` at login and \`fonts-noto-core\` ensures crisp Arabic glyph shaping.
`;
}

function generateBuildIsoScript(config: OsBuildConfig): string {
  const browserTcz =
    config.browser === 'falkon'
      ? 'falkon.tcz'
      : config.browser === 'firefox-esr'
      ? 'firefox_ESR.tcz'
      : 'midori.tcz';
  const terminalTcz =
    config.terminal === 'konsole'
      ? 'konsole-lite.tcz'
      : config.terminal === 'lxterminal'
      ? 'lxterminal.tcz'
      : 'alacritty.tcz';
  const fmTcz =
    config.fileManager === 'dolphin'
      ? 'dolphin-lite.tcz'
      : config.fileManager === 'pcmanfm'
      ? 'pcmanfm.tcz'
      : 'thunar.tcz';
  const includesPlasma =
    config.desktopEnvironment === 'kde-plasma-lite' ||
    config.desktopEnvironment === 'dual-plasma-openbox';
  const includesOpenbox =
    config.desktopEnvironment === 'openbox-tint2' ||
    config.desktopEnvironment === 'dual-plasma-openbox';
  const xkb = resolveXkbLayout(config);

  const xorissoCmd = buildXorissoCommand(config)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

  return `#!/usr/bin/env bash
# ==============================================================================
# CorePure64 Dual-Arch (x86 + x86_64) Hybrid OS Builder
# Builds a BIOS (ISOLINUX) + UEFI (BOOTX64/BOOTIA32) bootable ISO with:
# - Kernel-integrated Wine 10+ WoW64 (ntsync + binfmt_misc MZ) & Android (binderfs)
# - KDE Plasma Lite + Openbox/Tint2 GUI with guaranteed Xorg startup
# ==============================================================================
set -euo pipefail
IFS=$'\\n\\t'

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="\${WORK_DIR:-\${SCRIPT_DIR}/build_work}"
OUTPUT_DIR="\${OUTPUT_DIR:-\${SCRIPT_DIR}/dist}"
UI_CONFIGS_DIR="\${SCRIPT_DIR}/ui_configs"
KERNEL_CONFIG_FRAG="\${SCRIPT_DIR}/kernel_configs/corepure64-android-wine.config"
COMPAT_SCRIPT="\${SCRIPT_DIR}/setup_compat_layers.sh"

TC_VERSION="${config.tcVersion}"
TARGET_ARCH="${config.targetArch}"
TC_MIRROR_64="\${TC_MIRROR_64:-http://tinycorelinux.net/\${TC_VERSION}/x86_64}"
TC_MIRROR_32="\${TC_MIRROR_32:-http://tinycorelinux.net/\${TC_VERSION}/x86}"
KERNEL_VERSION="\${KERNEL_VERSION:-6.14.6}"
BUILD_KERNEL="\${BUILD_KERNEL:-false}"

OUTPUT_ISO="${config.isoName}"
VOLUME_ID="${config.volumeId}"
HOSTNAME_CFG="${config.hostname}"
PERSIST_LABEL="${config.persistenceLabel}"
DESKTOP_ENV="${config.desktopEnvironment}"
WINE_CHANNEL="${config.wineVersion === 'wine-10-staging' ? 'winehq-staging' : 'winehq-stable'}"
ANDROID_RUNTIME="${config.androidRuntime}"
KERNEL_INTEGRATION="${config.kernelIntegration ? 'true' : 'false'}"
EMBED_COMPAT_IN_CORE="${config.embedCompatInCore ? 'true' : 'false'}"
INCLUDE_WINE="${config.includeWine ? 'true' : 'false'}"
WINE_ONDEMAND="${config.wineOnDemand ? 'true' : 'false'}"
INCLUDE_WIFI="${config.includeWifiFirmware ? 'true' : 'false'}"
INCLUDE_PLASMA="${includesPlasma ? 'true' : 'false'}"
INCLUDE_OPENBOX="${includesOpenbox ? 'true' : 'false'}"

ISO_ROOT="\${WORK_DIR}/iso_root"
INITRD_DIR_64="\${WORK_DIR}/initrd_64"
INITRD_DIR_32="\${WORK_DIR}/initrd_32"
OVERLAY_DIR="\${WORK_DIR}/custom_ui_overlay"
PLASMA_DIR="\${WORK_DIR}/plasma_lite_root"
WINE10_DIR="\${WORK_DIR}/wine10_wow64_root"
KERNEL_WORK="\${WORK_DIR}/kernel_build"
CACHE_DIR="\${WORK_DIR}/tcz_cache"
EFI_WORK="\${WORK_DIR}/efi_build"

ISOLINUX_BIN=""
ISOHDPFX_BIN=""
LDLINUX_C32=""
MENU_C32=""
LIBUTIL_C32=""
IFCPU64_C32=""
TC_KERNEL_VER_64=""
TC_KERNEL_VER_32=""

log_info()  { printf '\\033[1;34m[INFO]\\033[0m  %s\\n' "$*"; }
log_warn()  { printf '\\033[1;33m[WARN]\\033[0m  %s\\n' "$*" >&2; }
log_error() { printf '\\033[1;31m[ERROR]\\033[0m %s\\n' "$*" >&2; }

cleanup() {
  local rc=$?
  if mountpoint -q "\${EFI_WORK}/mnt" 2>/dev/null; then
    umount "\${EFI_WORK}/mnt" || true
  fi
  if [[ $rc -ne 0 ]]; then
    log_error "Build failed with exit code \${rc}. Inspect \${WORK_DIR} for details."
  fi
}
trap cleanup EXIT INT TERM

locate_syslinux_file() {
  local filename="$1"
  shift
  for candidate in "$@"; do
    if [[ -f "\${candidate}/\${filename}" ]]; then
      printf '%s' "\${candidate}/\${filename}"
      return 0
    fi
  done
  return 1
}

check_host_deps() {
  log_info "Checking host build dependencies..."
  local required_cmds=(
    curl xorriso mksquashfs grub-mkstandalone mkfs.msdos mmd mcopy cpio gzip sha256sum md5sum
  )
  local missing=()
  for cmd in "\${required_cmds[@]}"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing+=("$cmd")
    fi
  done

  if (( \${#missing[@]} > 0 )); then
    log_error "Missing required host commands: $(printf '%s ' "\${missing[@]}")"
    log_error "On Debian/Ubuntu install: sudo apt-get install -y curl xorriso squashfs-tools grub-efi-amd64-bin grub-efi-ia32-bin grub-pc-bin dosfstools mtools isolinux syslinux-common cpio gzip mmdebstrap"
    exit 1
  fi

  local bios_dirs=(
    "/usr/lib/ISOLINUX"
    "/usr/lib/syslinux/modules/bios"
    "/usr/lib/syslinux/bios"
    "/usr/share/syslinux"
  )

  ISOLINUX_BIN="$(locate_syslinux_file "isolinux.bin" "\${bios_dirs[@]}" || true)"
  ISOHDPFX_BIN="$(locate_syslinux_file "isohdpfx.bin" "\${bios_dirs[@]}" || true)"
  LDLINUX_C32="$(locate_syslinux_file "ldlinux.c32" "\${bios_dirs[@]}" || true)"
  MENU_C32="$(locate_syslinux_file "menu.c32" "\${bios_dirs[@]}" || true)"
  LIBUTIL_C32="$(locate_syslinux_file "libutil.c32" "\${bios_dirs[@]}" || true)"
  IFCPU64_C32="$(locate_syslinux_file "ifcpu64.c32" "\${bios_dirs[@]}" || true)"

  for bin_var in ISOLINUX_BIN ISOHDPFX_BIN LDLINUX_C32 MENU_C32 LIBUTIL_C32; do
    if [[ -z "\${!bin_var}" ]]; then
      log_error "Could not locate Syslinux file for \${bin_var}. Ensure isolinux and syslinux-common are installed."
      exit 1
    fi
  done
}

prepare_workspace() {
  log_info "Preparing workspace directories in \${WORK_DIR} (target: \${TARGET_ARCH})..."
  rm -rf "\${ISO_ROOT}" "\${INITRD_DIR_64}" "\${INITRD_DIR_32}" "\${OVERLAY_DIR}" "\${PLASMA_DIR}" "\${WINE10_DIR}" "\${EFI_WORK}"
  mkdir -p \
    "\${ISO_ROOT}/boot/isolinux" \
    "\${ISO_ROOT}/boot/grub" \
    "\${ISO_ROOT}/cde/optional" \
    "\${ISO_ROOT}/cde/ondemand" \
    "\${ISO_ROOT}/cde32/optional" \
    "\${ISO_ROOT}/cde32/ondemand" \
    "\${INITRD_DIR_64}" \
    "\${INITRD_DIR_32}" \
    "\${OVERLAY_DIR}" \
    "\${PLASMA_DIR}" \
    "\${WINE10_DIR}" \
    "\${KERNEL_WORK}" \
    "\${CACHE_DIR}/x86_64" \
    "\${CACHE_DIR}/x86" \
    "\${EFI_WORK}" \
    "\${OUTPUT_DIR}"
}

build_custom_kernel_if_enabled() {
  if [[ "\${BUILD_KERNEL}" != "true" ]] || [[ "\${KERNEL_INTEGRATION}" != "true" ]]; then
    return 0
  fi

  log_info "Compiling custom Linux \${KERNEL_VERSION} kernel with built-in BinderFS, NTSync (Wine 10), binfmt_misc & IA32_EMULATION..."
  local ktar="\${CACHE_DIR}/linux-\${KERNEL_VERSION}.tar.xz"
  local ksrc="\${KERNEL_WORK}/linux-\${KERNEL_VERSION}"
  local major_ver="\${KERNEL_VERSION%%.*}"

  if [[ ! -s "\${ktar}" ]]; then
    curl -fSL --retry 3 "https://cdn.kernel.org/pub/linux/kernel/v\${major_ver}.x/linux-\${KERNEL_VERSION}.tar.xz" -o "\${ktar}"
  fi
  if [[ ! -d "\${ksrc}" ]]; then
    tar -xf "\${ktar}" -C "\${KERNEL_WORK}"
  fi

  if [[ "\${TARGET_ARCH}" != "x86" ]]; then
    (
      cd "\${ksrc}"
      make ARCH=x86_64 x86_64_defconfig
      ./scripts/kconfig/merge_config.sh -m .config "\${KERNEL_CONFIG_FRAG}"
      make ARCH=x86_64 olddefconfig
      make -j"$(nproc)" ARCH=x86_64 bzImage
      cp arch/x86/boot/bzImage "\${ISO_ROOT}/boot/vmlinuz64"
    )
  fi

  if [[ "\${TARGET_ARCH}" != "x86_64" ]]; then
    (
      cd "\${ksrc}"
      make ARCH=i386 i386_defconfig
      ./scripts/kconfig/merge_config.sh -m .config "\${KERNEL_CONFIG_FRAG}"
      make ARCH=i386 olddefconfig
      make -j"$(nproc)" ARCH=i386 bzImage
      cp arch/x86/boot/bzImage "\${ISO_ROOT}/boot/vmlinuz"
    )
  fi
}

download_base_files() {
  if [[ "\${TARGET_ARCH}" != "x86" ]]; then
    local url64="\${TC_MIRROR_64}/release/distribution_files"
    log_info "Fetching CorePure64 \${TC_VERSION} (x86_64) kernel & initrd..."
    for file in vmlinuz64 corepure64.gz; do
      if [[ ! -s "\${CACHE_DIR}/x86_64/\${file}" ]]; then
        curl -fSL --retry 3 --retry-delay 2 "\${url64}/\${file}" -o "\${CACHE_DIR}/x86_64/\${file}"
      fi
    done
    [[ ! -s "\${ISO_ROOT}/boot/vmlinuz64" ]] && cp "\${CACHE_DIR}/x86_64/vmlinuz64" "\${ISO_ROOT}/boot/vmlinuz64"
    TC_KERNEL_VER_64="$(curl -fsSL "\${TC_MIRROR_64}/tcz/" 2>/dev/null | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+-tinycore64' | head -n1 || echo '6.6.8-tinycore64')"
  fi

  if [[ "\${TARGET_ARCH}" != "x86_64" ]]; then
    local url32="\${TC_MIRROR_32}/release/distribution_files"
    log_info "Fetching TinyCore \${TC_VERSION} (32-bit x86) kernel & initrd..."
    for file in vmlinuz core.gz; do
      if [[ ! -s "\${CACHE_DIR}/x86/\${file}" ]]; then
        curl -fSL --retry 3 --retry-delay 2 "\${url32}/\${file}" -o "\${CACHE_DIR}/x86/\${file}"
      fi
    done
    [[ ! -s "\${ISO_ROOT}/boot/vmlinuz" ]] && cp "\${CACHE_DIR}/x86/vmlinuz" "\${ISO_ROOT}/boot/vmlinuz"
    TC_KERNEL_VER_32="$(curl -fsSL "\${TC_MIRROR_32}/tcz/" 2>/dev/null | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+-tinycore' | head -n1 || echo '6.6.8-tinycore')"
  fi
}

declare -A DOWNLOADED_TCZ=()

fetch_tcz_recursive() {
  local arch_tag="$1"
  local raw_pkg="$2"
  local optional_flag="\${3:-required}"

  local mirror_base="\${TC_MIRROR_64}"
  local kver="\${TC_KERNEL_VER_64}"
  local dest_cde="\${ISO_ROOT}/cde/optional"
  local cache_sub="\${CACHE_DIR}/x86_64"

  if [[ "\${arch_tag}" == "x86" ]]; then
    mirror_base="\${TC_MIRROR_32}"
    kver="\${TC_KERNEL_VER_32}"
    dest_cde="\${ISO_ROOT}/cde32/optional"
    cache_sub="\${CACHE_DIR}/x86"
  fi

  local pkg="\${raw_pkg//KERNEL/\${kver}}"
  pkg="\${pkg%%[[:space:]]*}"
  [[ -z "\${pkg}" ]] && return 0

  local key="\${arch_tag}:\${pkg}"
  if [[ -n "\${DOWNLOADED_TCZ[\${key}]:-}" ]]; then
    return 0
  fi
  DOWNLOADED_TCZ["\${key}"]=1

  local tcz_url="\${mirror_base}/tcz/\${pkg}"
  local dest_tcz="\${cache_sub}/\${pkg}"

  if [[ ! -s "\${dest_tcz}" ]]; then
    if ! curl -fsSL --retry 2 "\${tcz_url}" -o "\${dest_tcz}"; then
      if [[ "\${optional_flag}" == "optional" ]]; then
        log_warn "[\${arch_tag}] Optional extension \${pkg} not found on mirror; skipping."
        rm -f "\${dest_tcz}"
        return 0
      else
        log_error "[\${arch_tag}] Mandatory GUI/core extension \${pkg} failed to download from \${tcz_url}"
        return 1
      fi
    fi
  fi

  if curl -fsSL "\${tcz_url}.md5.txt" -o "\${dest_tcz}.md5.txt" 2>/dev/null; then
    (cd "\${cache_sub}" && md5sum -c "\${pkg}.md5.txt" >/dev/null 2>&1) || curl -fsSL "\${tcz_url}" -o "\${dest_tcz}"
    cp "\${dest_tcz}.md5.txt" "\${dest_cde}/"
  fi

  cp "\${dest_tcz}" "\${dest_cde}/"

  if curl -fsSL "\${tcz_url}.dep" -o "\${dest_tcz}.dep" 2>/dev/null; then
    cp "\${dest_tcz}.dep" "\${dest_cde}/"
    while IFS= read -r dep || [[ -n "\${dep}" ]]; do
      dep="\${dep%%#*}"
      dep="\${dep//\$'\\r'/}"
      [[ -z "\${dep}" ]] && continue
      fetch_tcz_recursive "\${arch_tag}" "\${dep}" "\${optional_flag}"
    done < "\${dest_tcz}.dep"
  fi
}

bundle_extensions_for_arch() {
  local arch_tag="$1"
  local cde_dir="\${ISO_ROOT}/cde"
  [[ "\${arch_tag}" == "x86" ]] && cde_dir="\${ISO_ROOT}/cde32"

  log_info "Resolving mandatory Xorg/D-Bus/Bash GUI stack for \${arch_tag}..."

  local mandatory_pkgs=(
    "bash.tcz"
    "dbus.tcz"
    "Xorg-7.7.tcz"
    "Xprogs.tcz"
    "Xlibs.tcz"
    "xf86-video-fbdev.tcz"
    "xf86-video-vesa.tcz"
    "xf86-input-libinput.tcz"
    "setxkbmap.tcz"
    "xkeyboard-config.tcz"
    "mesa-dri.tcz"
    "dejavu-fonts-ttf.tcz"
    "shared-mime-info.tcz"
    "desktop-file-utils.tcz"
  )

  if [[ "\${INCLUDE_OPENBOX}" == "true" ]]; then
    mandatory_pkgs+=("openbox.tcz" "tint2.tcz")
  fi

  local optional_pkgs=(
    "xf86-video-intel.tcz"
    "xf86-video-amdgpu.tcz"
    "xf86-video-vmware.tcz"
    "noto-fonts.tcz"
    "rofi.tcz"
    "feh.tcz"
    "pulseaudio.tcz"
    "volumeicon.tcz"
    "papirus-icon-theme.tcz"
    "network-manager-applet.tcz"
    "${fmTcz}"
    "${browserTcz}"
    "${terminalTcz}"
    "leafpad.tcz"
    "htop.tcz"
    "unzip.tcz"
    "p7zip.tcz"
    "tar.tcz"
    "zenity.tcz"
  )

  if [[ "\${INCLUDE_WIFI}" == "true" ]]; then
    optional_pkgs+=("wifi.tcz" "firmware-iwlwifi.tcz" "firmware-atheros.tcz" "firmware-rtlwifi.tcz")
  fi

  : > "\${cde_dir}/onboot.lst"

  for pkg in "\${mandatory_pkgs[@]}"; do
    fetch_tcz_recursive "\${arch_tag}" "\${pkg}" "required"
    printf '%s\\n' "\${pkg}" >> "\${cde_dir}/onboot.lst"
  done

  for pkg in "\${optional_pkgs[@]}"; do
    if fetch_tcz_recursive "\${arch_tag}" "\${pkg}" "optional" && [[ -f "\${cde_dir}/optional/\${pkg}" ]]; then
      printf '%s\\n' "\${pkg}" >> "\${cde_dir}/onboot.lst"
    fi
  done

  if [[ "\${ANDROID_RUNTIME}" == "waydroid-cage" ]]; then
    for apkg in "cage.tcz" "lxc.tcz" "waydroid.tcz"; do
      if fetch_tcz_recursive "\${arch_tag}" "\${apkg}" "optional" && [[ -f "\${cde_dir}/optional/\${apkg}" ]]; then
        [[ "\${apkg}" == "cage.tcz" || "\${apkg}" == "lxc.tcz" ]] && printf '%s\\n' "\${apkg}" >> "\${cde_dir}/onboot.lst"
      fi
    done
  else
    for apkg in "qemu-kvm.tcz" "android-tools.tcz"; do
      fetch_tcz_recursive "\${arch_tag}" "\${apkg}" "optional" || true
    done
  fi
}

build_wine10_wow64_tcz() {
  if [[ "\${INCLUDE_WINE}" != "true" ]] || [[ "\${TARGET_ARCH}" == "x86" ]]; then
    return 0
  fi

  local cached_wine10="\${CACHE_DIR}/x86_64/wine10-wow64.tcz"
  if [[ -s "\${cached_wine10}" ]]; then
    log_info "Using cached wine10-wow64.tcz (Wine 10+ WoW64)..."
    cp "\${cached_wine10}" "\${ISO_ROOT}/cde/optional/"
    (cd "\${ISO_ROOT}/cde/optional" && md5sum wine10-wow64.tcz > wine10-wow64.tcz.md5.txt)
    printf 'wine10-wow64.tcz\\n' >> "\${ISO_ROOT}/cde/onboot.lst"
    return 0
  fi

  if command -v mmdebstrap >/dev/null 2>&1; then
    log_info "Assembling Wine 10+ WoW64 (\${WINE_CHANNEL}) from WineHQ Debian repository..."
    local stage="\${WINE10_DIR}/rootfs"
    mkdir -p "\${stage}"

    # Pull WineHQ 10.x WoW64 (handles both 32-bit x86 and 64-bit x86_64 Windows PE binaries)
    if mmdebstrap --variant=minbase \
      --include="ca-certificates,curl,gnupg,\${WINE_CHANNEL},winetricks" \
      --aptopt='APT::Install-Recommends "false"' \
      --setup-hook='mkdir -p "$1/etc/apt/keyrings" && curl -fsSL https://dl.winehq.org/wine-builds/winehq.key -o "$1/etc/apt/keyrings/winehq-archive.key"' \
      --essential-hook='printf "deb [signed-by=/etc/apt/keyrings/winehq-archive.key] https://dl.winehq.org/wine-builds/debian/ bookworm main\\n" > "$1/etc/apt/sources.list.d/winehq.list"' \
      bookworm "\${stage}" http://deb.debian.org/debian; then

      local wver
      wver="$("\${stage}/opt/wine-stable/bin/wine" --version 2>/dev/null || "\${stage}/opt/wine-staging/bin/wine" --version 2>/dev/null || echo 'wine-10.0')"
      log_info "Packaged Wine version: \${wver}"

      mkdir -p "\${WINE10_DIR}/tcz/usr/local/wine10" "\${WINE10_DIR}/tcz/usr/local/bin"
      cp -a "\${stage}/opt/wine-"* "\${WINE10_DIR}/tcz/usr/local/wine10/" 2>/dev/null || cp -a "\${stage}/usr/"* "\${WINE10_DIR}/tcz/usr/local/wine10/"

      cat > "\${WINE10_DIR}/tcz/usr/local/bin/wine" <<'EOF'
#!/usr/bin/env bash
WINE_ROOT="$(find /usr/local/wine10 -maxdepth 2 -type f -name wine | head -n1)"
WINE_BASE="$(dirname "$(dirname "$WINE_ROOT")")"
export PATH="\${WINE_BASE}/bin:\${PATH}"
export LD_LIBRARY_PATH="\${WINE_BASE}/lib:\${WINE_BASE}/lib64:\${LD_LIBRARY_PATH:-}"
export WINENTSYNC=1
exec "\${WINE_ROOT}" "$@"
EOF
      chmod +x "\${WINE10_DIR}/tcz/usr/local/bin/wine"
      ln -sf /usr/local/bin/wine "\${WINE10_DIR}/tcz/usr/local/bin/wine64"

      mksquashfs "\${WINE10_DIR}/tcz" "\${cached_wine10}" -comp xz -b 256K -noappend >/dev/null
      cp "\${cached_wine10}" "\${ISO_ROOT}/cde/optional/"
      (cd "\${ISO_ROOT}/cde/optional" && md5sum wine10-wow64.tcz > wine10-wow64.tcz.md5.txt)
      if [[ "\${WINE_ONDEMAND}" == "true" ]] && [[ "\${EMBED_COMPAT_IN_CORE}" != "true" ]]; then
        printf '#!/usr/bin/env bash\\ntce-load -i wine10-wow64.tcz >/dev/null 2>&1 || true\\nexec wine "$@"\\n' > "\${ISO_ROOT}/cde/ondemand/wine"
        chmod +x "\${ISO_ROOT}/cde/ondemand/wine"
      else
        printf 'wine10-wow64.tcz\\n' >> "\${ISO_ROOT}/cde/onboot.lst"
      fi
      return 0
    fi
  fi

  log_warn "WineHQ 10 mmdebstrap unavailable; falling back to Tiny Core mirror wine.tcz"
  if fetch_tcz_recursive "x86_64" "wine.tcz" "optional" && [[ -f "\${ISO_ROOT}/cde/optional/wine.tcz" ]]; then
    printf 'wine.tcz\\n' >> "\${ISO_ROOT}/cde/onboot.lst"
  fi
}

build_kde_plasma_lite_tcz() {
  if [[ "\${INCLUDE_PLASMA}" != "true" ]] || [[ "\${TARGET_ARCH}" == "x86" ]]; then
    return 0
  fi

  local cached_plasma="\${CACHE_DIR}/x86_64/kde-plasma-lite.tcz"
  if [[ -s "\${cached_plasma}" ]]; then
    log_info "Using cached kde-plasma-lite.tcz..."
    cp "\${cached_plasma}" "\${ISO_ROOT}/cde/optional/"
    (cd "\${ISO_ROOT}/cde/optional" && md5sum kde-plasma-lite.tcz > kde-plasma-lite.tcz.md5.txt)
    printf 'kde-plasma-lite.tcz\\n' >> "\${ISO_ROOT}/cde/onboot.lst"
    return 0
  fi

  if command -v mmdebstrap >/dev/null 2>&1; then
    log_info "Assembling stripped KDE Plasma Lite SquashFS (kwin-x11, plasma-desktop, dolphin, konsole, breeze)..."
    local stage="\${PLASMA_DIR}/rootfs"
    mkdir -p "\${stage}"

    mmdebstrap --variant=minbase --include="plasma-desktop,kwin-x11,plasma-workspace,dolphin,konsole,breeze,breeze-icon-theme,dbus-x11,xinit,fonts-noto-core" \\
      --aptopt='APT::Install-Recommends "false"' \\
      --dpkgopt='path-exclude=/usr/share/doc/*' \\
      --dpkgopt='path-exclude=/usr/share/man/*' \\
      --dpkgopt='path-exclude=/usr/share/locale/*' \\
      bookworm "\${stage}" http://deb.debian.org/debian || {
        log_warn "mmdebstrap failed; falling back to Openbox+Tint2 GUI session."
        return 0
      }

    mkdir -p "\${PLASMA_DIR}/tcz_pkg/usr/local/kde-lite" "\${PLASMA_DIR}/tcz_pkg/usr/local/bin" "\${PLASMA_DIR}/tcz_pkg/etc/ld.so.conf.d"
    mv "\${stage}/usr/"* "\${PLASMA_DIR}/tcz_pkg/usr/local/kde-lite/" || true
    printf '/usr/local/kde-lite/lib/x86_64-linux-gnu\\n/usr/local/kde-lite/lib\\n' > "\${PLASMA_DIR}/tcz_pkg/etc/ld.so.conf.d/kde-lite.conf"

    cat > "\${PLASMA_DIR}/tcz_pkg/usr/local/bin/startplasma-lite" <<'EOF'
#!/usr/bin/env bash
export KDE_LITE_PREFIX="/usr/local/kde-lite"
export PATH="\${KDE_LITE_PREFIX}/bin:\${PATH}"
export LD_LIBRARY_PATH="\${KDE_LITE_PREFIX}/lib/x86_64-linux-gnu:\${KDE_LITE_PREFIX}/lib:\${LD_LIBRARY_PATH:-}"
export XDG_DATA_DIRS="\${KDE_LITE_PREFIX}/share:/usr/local/share:/usr/share"
export QT_PLUGIN_PATH="\${KDE_LITE_PREFIX}/lib/x86_64-linux-gnu/qt5/plugins"
export QML2_IMPORT_PATH="\${KDE_LITE_PREFIX}/lib/x86_64-linux-gnu/qt5/qml"
exec "\${KDE_LITE_PREFIX}/bin/startplasma-x11"
EOF
    chmod +x "\${PLASMA_DIR}/tcz_pkg/usr/local/bin/startplasma-lite"

    mksquashfs "\${PLASMA_DIR}/tcz_pkg" "\${cached_plasma}" -comp xz -b 256K -noappend >/dev/null
    cp "\${cached_plasma}" "\${ISO_ROOT}/cde/optional/"
    (cd "\${ISO_ROOT}/cde/optional" && md5sum kde-plasma-lite.tcz > kde-plasma-lite.tcz.md5.txt)
    printf 'kde-plasma-lite.tcz\\n' >> "\${ISO_ROOT}/cde/onboot.lst"
  else
    log_warn "mmdebstrap not installed on host; skipping local KDE Plasma Lite assembly (Openbox+Tint2 GUI remains active)."
  fi
}

populate_core_compat_files() {
  local target_root="$1"
  mkdir -p \
    "\${target_root}/etc/X11/xorg.conf.d" \
    "\${target_root}/etc/binfmt.d" \
    "\${target_root}/etc/udev/rules.d" \
    "\${target_root}/usr/local/share/applications" \
    "\${target_root}/usr/local/bin"

  cp "\${UI_CONFIGS_DIR}/applications/"*.desktop "\${target_root}/usr/local/share/applications/"

  cat > "\${target_root}/etc/X11/xorg.conf.d/10-modesetting.conf" <<'EOF'
Section "Device"
    Identifier "DefaultGPU"
    Driver "modesetting"
EndSection
EOF

  # System-wide Xorg XKB Keyboard Layout (English primary + Arabic secondary)
  cat > "\${target_root}/etc/X11/xorg.conf.d/00-keyboard.conf" <<'EOF'
Section "InputClass"
    Identifier "system-keyboard"
    MatchIsKeyboard "on"
    Option "XkbModel" "pc105"
    Option "XkbLayout" "${xkb.layout}"
    Option "XkbVariant" "${xkb.variant}"
    Option "XkbOptions" "${config.keyboardToggle}"
EndSection
EOF

  # Kernel binfmt_misc direct execve() rules for MZ (.exe) and .apk
  cat > "\${target_root}/etc/binfmt.d/wine10.conf" <<'EOF'
:DOSWin:M::MZ::/usr/local/bin/wine-exe-runner:
EOF
  cat > "\${target_root}/etc/binfmt.d/android-apk.conf" <<'EOF'
:AndroidAPK:E::apk::/usr/local/bin/android-apk-runner:
EOF

  # Grant user 'tc' (staff) direct access to Wine 10 /dev/ntsync & Android /dev/binderfs
  cat > "\${target_root}/etc/udev/rules.d/99-ntsync-binder.rules" <<'EOF'
KERNEL=="ntsync", MODE="0666"
SUBSYSTEM=="binder", MODE="0666"
EOF

  cat > "\${target_root}/usr/local/bin/wine-exe-runner" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
TARGET="\${1:-}"
if ! command -v wine >/dev/null 2>&1; then
  for ext in wine10-wow64.tcz wine.tcz; do
    if [ -f "/etc/sysconfig/tcedir/optional/\${ext}" ]; then
      tce-load -i "/etc/sysconfig/tcedir/optional/\${ext}" >/dev/null 2>&1 || true
      break
    fi
  done
fi
if ! command -v wine >/dev/null 2>&1; then
  zenity --error --title="Wine 10 Missing" --text="wine10-wow64.tcz is not loaded." 2>/dev/null || true
  exit 1
fi
export WINEPREFIX="\${WINEPREFIX:-\${HOME}/.wine}"
export WINENTSYNC=1
export WINEDEBUG="-all"
case "\${TARGET,,}" in
  *.msi) exec wine msiexec /i "\${TARGET}" ;;
  *.exe) exec wine "\${TARGET}" ;;
  *)     exec wine explorer ;;
esac
EOF
  chmod +x "\${target_root}/usr/local/bin/wine-exe-runner"

  if [[ "\${ANDROID_RUNTIME}" == "waydroid-cage" ]]; then
    cat > "\${target_root}/usr/local/bin/android-apk-runner" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
APK_FILE="\${1:-}"
if ! command -v waydroid >/dev/null 2>&1 || ! command -v cage >/dev/null 2>&1; then
  zenity --error --title="Android Runtime Missing" --text="Load waydroid.tcz and cage.tcz." 2>/dev/null || true
  exit 1
fi
if ! pgrep -f "waydroid.*container" >/dev/null 2>&1; then
  sudo waydroid container start >/tmp/waydroid-container.log 2>&1 &
  sleep 2
fi
if [[ -n "\${APK_FILE}" && -f "\${APK_FILE}" ]]; then
  waydroid app install "\${APK_FILE}"
fi
export WAYLAND_DISPLAY=wayland-waydroid
exec cage -s -- waydroid show-full-ui
EOF
  else
    cat > "\${target_root}/usr/local/bin/android-apk-runner" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
APK_FILE="\${1:-}"
WORK_IMG="\${HOME}/.local/share/android-vm/android-overlay.qcow2"
if ! command -v qemu-system-x86_64 >/dev/null 2>&1; then
  zenity --error --title="QEMU-KVM Missing" --text="Load qemu-kvm.tcz." 2>/dev/null || true
  exit 1
fi
if ! pgrep -f "qemu-system-x86_64.*android" >/dev/null 2>&1; then
  mkdir -p "$(dirname "\${WORK_IMG}")"
  qemu-system-x86_64 -enable-kvm -m 1024 -smp 2 -vga virtio -display gtk,gl=on \
    -netdev user,id=net0,hostfwd=tcp::5555-:5555 -device virtio-net-pci,netdev=net0 \
    -drive file="\${WORK_IMG}",if=virtio,format=qcow2 -name "Android Runtime" >/tmp/android-vm.log 2>&1 &
  sleep 4
fi
if [[ -n "\${APK_FILE}" && -f "\${APK_FILE}" ]] && command -v adb >/dev/null 2>&1; then
  adb connect 127.0.0.1:5555 >/dev/null 2>&1 || true
  adb install -r "\${APK_FILE}"
fi
EOF
  fi
  chmod +x "\${target_root}/usr/local/bin/android-apk-runner"

  if [[ -f "\${COMPAT_SCRIPT}" ]]; then
    cp "\${COMPAT_SCRIPT}" "\${target_root}/usr/local/bin/setup_compat_layers.sh"
    chmod +x "\${target_root}/usr/local/bin/setup_compat_layers.sh"
  fi
}

build_custom_ui_overlay_tcz() {
  log_info "Building custom-ui-overlay.tcz SquashFS layer..."
  local skel="\${OVERLAY_DIR}/etc/skel"
  mkdir -p "\${skel}/.config/openbox" "\${skel}/.config/tint2" "\${skel}/.config/rofi" "\${skel}/.config/gtk-3.0"

  cp "\${UI_CONFIGS_DIR}/openbox/rc.xml"      "\${skel}/.config/openbox/rc.xml"
  cp "\${UI_CONFIGS_DIR}/openbox/autostart"   "\${skel}/.config/openbox/autostart"
  cp "\${UI_CONFIGS_DIR}/openbox/menu.xml"    "\${skel}/.config/openbox/menu.xml"
  cp "\${UI_CONFIGS_DIR}/tint2/tint2rc"      "\${skel}/.config/tint2/tint2rc"
  cp "\${UI_CONFIGS_DIR}/rofi/config.rasi"   "\${skel}/.config/rofi/config.rasi"
  cp "\${UI_CONFIGS_DIR}/gtk-3.0/settings.ini" "\${skel}/.config/gtk-3.0/settings.ini"
  cp "\${UI_CONFIGS_DIR}/mimeapps.list"      "\${skel}/.config/mimeapps.list"
  chmod +x "\${skel}/.config/openbox/autostart"

  if [[ -d "\${UI_CONFIGS_DIR}/kde-plasma" ]]; then
    cp "\${UI_CONFIGS_DIR}/kde-plasma/kdeglobals"  "\${skel}/.config/kdeglobals"
    cp "\${UI_CONFIGS_DIR}/kde-plasma/kwinrc"      "\${skel}/.config/kwinrc"
    cp "\${UI_CONFIGS_DIR}/kde-plasma/baloofilerc" "\${skel}/.config/baloofilerc"
    cp "\${UI_CONFIGS_DIR}/kde-plasma/kxkbrc"      "\${skel}/.config/kxkbrc"
  fi

  # Bundle Arabic Noto fonts into overlay if available on build host
  if [[ -d /usr/share/fonts/truetype/noto ]]; then
    mkdir -p "\${OVERLAY_DIR}/usr/local/share/fonts/arabic"
    cp /usr/share/fonts/truetype/noto/Noto*Arabic*.ttf "\${OVERLAY_DIR}/usr/local/share/fonts/arabic/" 2>/dev/null || true
  fi

  populate_core_compat_files "\${OVERLAY_DIR}"

  cat > "\${skel}/.xsession" <<'EOF'
#!/bin/sh
export LANG="C.UTF-8"
export LC_ALL="C.UTF-8"
export XDG_CONFIG_HOME="$HOME/.config"
export GTK_THEME="Adwaita${config.desktopTheme === 'slate-dark' ? ':dark' : ''}"
export WINENTSYNC=1
command -v setxkbmap >/dev/null 2>&1 && setxkbmap -model pc105 -layout "${xkb.layout}" -variant "${xkb.variant}" -option "" -option "${config.keyboardToggle}" || true

launch_session() {
  if [ "${config.desktopEnvironment}" != "openbox-tint2" ] && command -v startplasma-lite >/dev/null 2>&1; then
    export XDG_CURRENT_DESKTOP=KDE
    exec startplasma-lite
  elif [ "${config.desktopEnvironment}" != "openbox-tint2" ] && command -v startplasma-x11 >/dev/null 2>&1; then
    export XDG_CURRENT_DESKTOP=KDE
    exec startplasma-x11
  else
    export XDG_CURRENT_DESKTOP=Openbox
    exec openbox-session
  fi
}

if command -v dbus-launch >/dev/null 2>&1 && [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
  exec dbus-launch --exit-with-session sh -c "$(declare -f launch_session); launch_session"
else
  launch_session
fi
EOF
  chmod +x "\${skel}/.xsession"

  mksquashfs "\${OVERLAY_DIR}" "\${ISO_ROOT}/cde/optional/custom-ui-overlay.tcz" -comp xz -b 256K -noappend >/dev/null
  (cd "\${ISO_ROOT}/cde/optional" && md5sum custom-ui-overlay.tcz > custom-ui-overlay.tcz.md5.txt)
  printf 'custom-ui-overlay.tcz\\n' >> "\${ISO_ROOT}/cde/onboot.lst"

  if [[ "\${TARGET_ARCH}" != "x86_64" ]]; then
    cp "\${ISO_ROOT}/cde/optional/custom-ui-overlay.tcz" "\${ISO_ROOT}/cde32/optional/"
    cp "\${ISO_ROOT}/cde/optional/custom-ui-overlay.tcz.md5.txt" "\${ISO_ROOT}/cde32/optional/"
    printf 'custom-ui-overlay.tcz\\n' >> "\${ISO_ROOT}/cde32/onboot.lst"
  fi
}

remaster_single_initrd() {
  local src_gz="$1"
  local dest_gz="$2"
  local work_dir="$3"

  log_info "Remastering initrd $(basename "\${dest_gz}") (baking kernel binfmt_misc, binderfs, /home/tc & compat layers)..."
  (cd "\${work_dir}" && zcat "\${src_gz}" | cpio -idm --quiet)
  printf '%s\\n' "\${HOSTNAME_CFG}" > "\${work_dir}/etc/hostname"

  if [[ "\${EMBED_COMPAT_IN_CORE}" == "true" ]]; then
    populate_core_compat_files "\${work_dir}"
  fi

  for user_home in "\${work_dir}/etc/skel" "\${work_dir}/home/tc"; do
    mkdir -p "\${user_home}/.config/openbox" "\${user_home}/.config/tint2" "\${user_home}/.config/rofi" "\${user_home}/.config/gtk-3.0"
    cp "\${UI_CONFIGS_DIR}/openbox/"* "\${user_home}/.config/openbox/"
    cp "\${UI_CONFIGS_DIR}/tint2/tint2rc" "\${user_home}/.config/tint2/tint2rc"
    cp "\${UI_CONFIGS_DIR}/rofi/config.rasi" "\${user_home}/.config/rofi/config.rasi"
    cp "\${UI_CONFIGS_DIR}/gtk-3.0/settings.ini" "\${user_home}/.config/gtk-3.0/settings.ini"
    cp "\${UI_CONFIGS_DIR}/mimeapps.list" "\${user_home}/.config/mimeapps.list"
    if [[ -d "\${UI_CONFIGS_DIR}/kde-plasma" ]]; then
      cp "\${UI_CONFIGS_DIR}/kde-plasma/kdeglobals" "\${user_home}/.config/kdeglobals"
      cp "\${UI_CONFIGS_DIR}/kde-plasma/kwinrc" "\${user_home}/.config/kwinrc"
      cp "\${UI_CONFIGS_DIR}/kde-plasma/baloofilerc" "\${user_home}/.config/baloofilerc"
      cp "\${UI_CONFIGS_DIR}/kde-plasma/kxkbrc" "\${user_home}/.config/kxkbrc"
    fi
    cp "\${OVERLAY_DIR}/etc/skel/.xsession" "\${user_home}/.xsession"
    chmod +x "\${user_home}/.xsession" "\${user_home}/.config/openbox/autostart"

    if ! grep -q ".x11_attempted" "\${user_home}/.profile" 2>/dev/null; then
      cat >> "\${user_home}/.profile" <<'EOF'

if [ -z "$DISPLAY" ] && [ "$(tty 2>/dev/null)" = "/dev/tty1" ] && [ ! -f /tmp/.x11_attempted ] && command -v startx >/dev/null 2>&1; then
  touch /tmp/.x11_attempted
  startx || echo "[CorePure64] X11 failed to start. Run 'xsetup' or inspect /var/log/Xorg.0.log."
fi
EOF
    fi
  done

  chown -R 1001:50 "\${work_dir}/home/tc" 2>/dev/null || true

  mkdir -p "\${work_dir}/opt"
  cat > "\${work_dir}/opt/bootlocal.sh" <<'EOF'
#!/bin/sh
# 1. Refresh dynamic linker cache (KDE Lite / Wine 10)
[ -f /etc/ld.so.conf.d/kde-lite.conf ] && ldconfig >/dev/null 2>&1 || true

# 2. Kernel-level BinderFS mount for direct Android APK containers
if grep -qw binder /proc/filesystems 2>/dev/null; then
  mkdir -p /dev/binderfs
  mount -t binder binder /dev/binderfs 2>/dev/null || true
  for dev in binder hwbinder vndbinder; do
    [ -e "/dev/binderfs/$dev" ] && [ ! -e "/dev/$dev" ] && ln -sf "/dev/binderfs/$dev" "/dev/$dev"
  done
else
  modprobe binder_linux devices="binder,hwbinder,vndbinder" 2>/dev/null || true
fi

# 3. Kernel-level Wine 10 NTSync device permissions
[ -c /dev/ntsync ] && chmod 0666 /dev/ntsync 2>/dev/null || true

# 4. Kernel binfmt_misc registration for direct ./app.exe and ./app.apk execution
if [ -d /proc/sys/fs/binfmt_misc ] || modprobe binfmt_misc 2>/dev/null; then
  mount -t binfmt_misc none /proc/sys/fs/binfmt_misc 2>/dev/null || true
  if [ -w /proc/sys/fs/binfmt_misc/register ]; then
    [ ! -f /proc/sys/fs/binfmt_misc/DOSWin ] && \
      printf '%s\\n' ':DOSWin:M::MZ::/usr/local/bin/wine-exe-runner:' > /proc/sys/fs/binfmt_misc/register 2>/dev/null || true
    [ ! -f /proc/sys/fs/binfmt_misc/AndroidAPK ] && \
      printf '%s\\n' ':AndroidAPK:E::apk::/usr/local/bin/android-apk-runner:' > /proc/sys/fs/binfmt_misc/register 2>/dev/null || true
  fi
fi

# 5. Start D-Bus and user-space compatibility layer initialization
[ -x /usr/local/etc/init.d/dbus ] && /usr/local/etc/init.d/dbus start >/dev/null 2>&1 || true
if [ -x /usr/local/bin/setup_compat_layers.sh ]; then
  su - tc -c "/usr/local/bin/setup_compat_layers.sh --boot-init" >/var/log/compat-init.log 2>&1 &
fi
EOF
  chmod +x "\${work_dir}/opt/bootlocal.sh"

  (cd "\${work_dir}" && find . | cpio -o -H newc --quiet | gzip -9 > "\${dest_gz}")
}

remaster_all_initrds() {
  if [[ "\${TARGET_ARCH}" != "x86" ]]; then
    remaster_single_initrd "\${CACHE_DIR}/x86_64/corepure64.gz" "\${ISO_ROOT}/boot/corepure64.gz" "\${INITRD_DIR_64}"
  fi
  if [[ "\${TARGET_ARCH}" != "x86_64" ]]; then
    remaster_single_initrd "\${CACHE_DIR}/x86/core.gz" "\${ISO_ROOT}/boot/core.gz" "\${INITRD_DIR_32}"
  fi
}

setup_bios_isolinux() {
  log_info "Configuring ISOLINUX (Dual x86 / x86_64 Legacy BIOS bootloader)..."
  cp "\${ISOLINUX_BIN}" "\${ISO_ROOT}/boot/isolinux/"
  cp "\${LDLINUX_C32}"  "\${ISO_ROOT}/boot/isolinux/"
  cp "\${MENU_C32}"     "\${ISO_ROOT}/boot/isolinux/"
  cp "\${LIBUTIL_C32}"  "\${ISO_ROOT}/boot/isolinux/"
  [[ -n "\${IFCPU64_C32}" ]] && cp "\${IFCPU64_C32}" "\${ISO_ROOT}/boot/isolinux/"

  cat > "\${ISO_ROOT}/boot/isolinux/isolinux.cfg" <<EOF
UI menu.c32
PROMPT 0
TIMEOUT 50
DEFAULT ${config.targetArch === 'x86' ? 'live32' : 'auto'}

MENU TITLE CorePure64 ${config.tcVersion} Dual-Arch (x86 + x86_64) Hybrid OS

EOF

  if [[ "\${TARGET_ARCH}" == "dual-x86-x86_64" ]] && [[ -n "\${IFCPU64_C32}" ]]; then
    cat >> "\${ISO_ROOT}/boot/isolinux/isolinux.cfg" <<'EOF'
LABEL auto
  MENU LABEL Auto-Detect CPU (x86_64 / x86) + Wine 10 + Android
  COM32 ifcpu64.c32
  APPEND live64 -- live32

EOF
  fi

  if [[ "\${TARGET_ARCH}" != "x86" ]]; then
    cat >> "\${ISO_ROOT}/boot/isolinux/isolinux.cfg" <<EOF
LABEL live64
  MENU LABEL CorePure64 (x86_64) Desktop + Wine 10 WoW64 + Android APK
  KERNEL /boot/vmlinuz64
  INITRD /boot/corepure64.gz
  APPEND cde vga=791 quiet loglevel=3

LABEL persist64
  MENU LABEL CorePure64 (x86_64) Persistent Storage (LABEL=\${PERSIST_LABEL})
  KERNEL /boot/vmlinuz64
  INITRD /boot/corepure64.gz
  APPEND tce=LABEL=\${PERSIST_LABEL} opt=LABEL=\${PERSIST_LABEL} home=LABEL=\${PERSIST_LABEL} vga=791 quiet
EOF
  fi

  if [[ "\${TARGET_ARCH}" != "x86_64" ]]; then
    cat >> "\${ISO_ROOT}/boot/isolinux/isolinux.cfg" <<EOF
LABEL live32
  MENU LABEL TinyCore (x86 32-bit) Desktop + Android + Compatibility
  KERNEL /boot/vmlinuz
  INITRD /boot/core.gz
  APPEND cde=cde32 vga=791 quiet loglevel=3
EOF
  fi

  cat >> "\${ISO_ROOT}/boot/isolinux/isolinux.cfg" <<EOF
LABEL safe
  MENU LABEL Safe Graphics (VESA / No KMS)
  KERNEL /boot/${config.targetArch === 'x86' ? 'vmlinuz' : 'vmlinuz64'}
  INITRD /boot/${config.targetArch === 'x86' ? 'core.gz' : 'corepure64.gz'}
  APPEND ${config.targetArch === 'x86' ? 'cde=cde32' : 'cde'} nomodeset xsetup
EOF
}

setup_uefi_grub() {
  log_info "Building GRUB2 Dual-UEFI image (boot/grub/efi.img: BOOTX64.EFI + BOOTIA32.EFI)..."

  cat > "\${ISO_ROOT}/boot/grub/grub.cfg" <<EOF
set default=0
set timeout=5

insmod all_video
insmod gfxterm
terminal_output gfxterm

if cpuid -l; then
  menuentry "CorePure64 (x86_64) — KDE Plasma Lite + Wine 10 + Android APK" {
    linux /boot/vmlinuz64 cde quiet loglevel=3
    initrd /boot/corepure64.gz
  }
  menuentry "CorePure64 (x86_64) Persistent Storage (LABEL=\${PERSIST_LABEL})" {
    linux /boot/vmlinuz64 tce=LABEL=\${PERSIST_LABEL} opt=LABEL=\${PERSIST_LABEL} home=LABEL=\${PERSIST_LABEL} quiet
    initrd /boot/corepure64.gz
  }
else
  menuentry "TinyCore (x86 32-bit) — Desktop + Compatibility" {
    linux /boot/vmlinuz cde=cde32 quiet loglevel=3
    initrd /boot/core.gz
  }
fi

menuentry "Safe Graphics Mode (nomodeset)" {
  if cpuid -l; then
    linux /boot/vmlinuz64 cde nomodeset xsetup
    initrd /boot/corepure64.gz
  else
    linux /boot/vmlinuz cde=cde32 nomodeset xsetup
    initrd /boot/core.gz
  fi
}
EOF

  cat > "\${EFI_WORK}/grub-embed.cfg" <<'EOF'
search --no-floppy --file --set=root /boot/grub/grub.cfg
set prefix=($root)/boot/grub
configfile ($root)/boot/grub/grub.cfg
EOF

  local grub_mods="part_gpt part_msdos iso9660 fat ext2 normal boot linux configfile search search_label search_fs_uuid all_video efi_gop efi_uga gfxterm cpuid"

  grub-mkstandalone \\
    --format=x86_64-efi \\
    --output="\${EFI_WORK}/BOOTX64.EFI" \\
    --locales="" \\
    --fonts="" \\
    --modules="\${grub_mods}" \\
    "boot/grub/grub.cfg=\${EFI_WORK}/grub-embed.cfg"

  local efi_img="\${ISO_ROOT}/boot/grub/efi.img"
  dd if=/dev/zero of="\${efi_img}" bs=1M count=20 status=none
  mkfs.msdos -F 16 -n "EFIBOOT" "\${efi_img}" >/dev/null
  mmd -i "\${efi_img}" ::/EFI ::/EFI/BOOT
  mcopy -i "\${efi_img}" "\${EFI_WORK}/BOOTX64.EFI" ::/EFI/BOOT/BOOTX64.EFI

  # Also bundle 32-bit UEFI (BOOTIA32.EFI) when grub-efi-ia32-bin is installed on host
  if [[ -d /usr/lib/grub/i386-efi ]]; then
    grub-mkstandalone \\
      --format=i386-efi \\
      --output="\${EFI_WORK}/BOOTIA32.EFI" \\
      --locales="" \\
      --fonts="" \\
      --modules="\${grub_mods}" \\
      "boot/grub/grub.cfg=\${EFI_WORK}/grub-embed.cfg"
    mcopy -i "\${efi_img}" "\${EFI_WORK}/BOOTIA32.EFI" ::/EFI/BOOT/BOOTIA32.EFI
  fi
}

package_hybrid_iso() {
  log_info "Packaging bootable BIOS+UEFI hybrid ISO via xorriso..."
${xorissoCmd}

  local iso_path="\${OUTPUT_DIR}/\${OUTPUT_ISO}"
  local iso_size
  iso_size="$(du -h "\${iso_path}" | awk '{print $1}')"
  sha256sum "\${iso_path}" > "\${iso_path}.sha256"
  log_info "Success! Created \${iso_path} (\${iso_size})"
  log_info "SHA-256 written to \${iso_path}.sha256"
}

main() {
  check_host_deps
  prepare_workspace
  build_custom_kernel_if_enabled
  download_base_files
  if [[ "\${TARGET_ARCH}" != "x86" ]]; then
    bundle_extensions_for_arch "x86_64"
  fi
  if [[ "\${TARGET_ARCH}" != "x86_64" ]]; then
    bundle_extensions_for_arch "x86"
  fi
  build_wine10_wow64_tcz
  build_kde_plasma_lite_tcz
  build_custom_ui_overlay_tcz
  remaster_all_initrds
  setup_bios_isolinux
  setup_uefi_grub
  package_hybrid_iso
}

main "$@"
`;
}

function generateSetupCompatScript(config: OsBuildConfig): string {
  const androidSection =
    config.androidRuntime === 'waydroid-cage'
      ? `# ------------------------------------------------------------------------------
# 3. Android (.apk) Layer — Kernel BinderFS + Waydroid + Cage Wayland-in-X11
# ------------------------------------------------------------------------------
init_android_layer() {
  log_info "Verifying kernel BinderFS & Waydroid + Cage APK runtime..."
  mkdir -p "\${ANDROID_STATE_DIR}" "\${HOME}/.local/bin"

  if [[ ! -e /dev/binder ]] && [[ ! -d /dev/binderfs ]] && command -v modinfo >/dev/null 2>&1; then
    for mod in binder_linux ashmem_linux; do
      if modinfo "$mod" >/dev/null 2>&1; then
        run_as_root modprobe "$mod" 2>/dev/null || true
      fi
    done
  fi

  local runner_path="/usr/local/bin/android-apk-runner"
  if [[ ! -x "\${runner_path}" ]]; then
    if [[ ! -w /usr/local/bin ]]; then
      runner_path="\${HOME}/.local/bin/android-apk-runner"
    fi
    cat > "\${runner_path}" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
APK_FILE="\${1:-}"

if ! command -v waydroid >/dev/null 2>&1 || ! command -v cage >/dev/null 2>&1; then
  zenity --error --title="Android Runtime Missing" \\
    --text="Load waydroid.tcz and cage.tcz (plus Android SquashFS images in /var/lib/waydroid/images) to execute APK packages." 2>/dev/null || true
  exit 1
fi

if ! pgrep -f "waydroid.*container" >/dev/null 2>&1; then
  if [[ "$(id -u)" -eq 0 ]]; then
    waydroid container start >/tmp/waydroid-container.log 2>&1 &
  elif command -v sudo >/dev/null 2>&1; then
    sudo waydroid container start >/tmp/waydroid-container.log 2>&1 &
  fi
  sleep 2
fi

if [[ -n "\${APK_FILE}" && -f "\${APK_FILE}" ]]; then
  waydroid app install "\${APK_FILE}" || {
    zenity --error --title="APK Install Failed" --text="Could not install \${APK_FILE} into Waydroid." 2>/dev/null || true
    exit 1
  }
fi

export WAYLAND_DISPLAY=wayland-waydroid
exec cage -s -- waydroid show-full-ui
WRAPPER
    chmod +x "\${runner_path}"
  fi
}`
      : `# ------------------------------------------------------------------------------
# 3. Android (.apk) Layer — Lightweight QEMU-KVM Android Micro-VM + ADB
# ------------------------------------------------------------------------------
init_android_layer() {
  log_info "Configuring QEMU-KVM Android micro-VM + ADB APK runner..."
  mkdir -p "\${ANDROID_STATE_DIR}" "\${HOME}/.local/bin"

  local runner_path="/usr/local/bin/android-apk-runner"
  if [[ ! -x "\${runner_path}" ]]; then
    if [[ ! -w /usr/local/bin ]]; then
      runner_path="\${HOME}/.local/bin/android-apk-runner"
    fi
    cat > "\${runner_path}" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
APK_FILE="\${1:-}"
WORK_IMG="\${HOME}/.local/share/android-vm/android-overlay.qcow2"

if ! command -v qemu-system-x86_64 >/dev/null 2>&1; then
  zenity --error --title="QEMU-KVM Missing" --text="Load qemu-kvm.tcz to launch the Android micro-VM." 2>/dev/null || true
  exit 1
fi

if ! pgrep -f "qemu-system-x86_64.*android" >/dev/null 2>&1; then
  mkdir -p "$(dirname "\${WORK_IMG}")"
  qemu-system-x86_64 -enable-kvm -m 1024 -smp 2 \\
    -vga virtio -display gtk,gl=on \\
    -netdev user,id=net0,hostfwd=tcp::5555-:5555 -device virtio-net-pci,netdev=net0 \\
    -drive file="\${WORK_IMG}",if=virtio,format=qcow2 \\
    -name "Android Runtime" >/tmp/android-vm.log 2>&1 &
  sleep 4
fi

if [[ -n "\${APK_FILE}" && -f "\${APK_FILE}" ]] && command -v adb >/dev/null 2>&1; then
  adb connect 127.0.0.1:5555 >/dev/null 2>&1 || true
  adb install -r "\${APK_FILE}"
fi
WRAPPER
    chmod +x "\${runner_path}"
  fi
}`;

  return `#!/usr/bin/env bash
# ==============================================================================
# CorePure64 Compatibility Layers Initializer
# Verifies Wine 10+ WoW64 (/dev/ntsync), kernel binfmt_misc (MZ/APK),
# BinderFS, and XDG MIME desktop integration.
# ==============================================================================
set -euo pipefail

WINE_PREFIX="\${WINEPREFIX:-\${HOME}/.wine}"
ANDROID_STATE_DIR="\${HOME}/.local/share/android-runtime"
MIME_LIST="\${HOME}/.config/mimeapps.list"

log_info() { printf '[compat-setup] %s\\n' "$*"; }

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    return 1
  fi
}

# ------------------------------------------------------------------------------
# 1. Kernel binfmt_misc Verification (Direct ./app.exe & ./app.apk execution)
# ------------------------------------------------------------------------------
verify_kernel_binfmt() {
  if [[ -d /proc/sys/fs/binfmt_misc ]]; then
    if [[ ! -f /proc/sys/fs/binfmt_misc/DOSWin ]] && [[ -w /proc/sys/fs/binfmt_misc/register ]]; then
      printf '%s\\n' ':DOSWin:M::MZ::/usr/local/bin/wine-exe-runner:' > /proc/sys/fs/binfmt_misc/register 2>/dev/null || true
    fi
    if [[ ! -f /proc/sys/fs/binfmt_misc/AndroidAPK ]] && [[ -w /proc/sys/fs/binfmt_misc/register ]]; then
      printf '%s\\n' ':AndroidAPK:E::apk::/usr/local/bin/android-apk-runner:' > /proc/sys/fs/binfmt_misc/register 2>/dev/null || true
    fi
    log_info "Kernel binfmt_misc active for direct PE/MZ (.exe) & APK execution."
  fi
}

# ------------------------------------------------------------------------------
# 2. Windows (.exe / .msi) Layer — Wine 10+ WoW64 Prefix & NTSync
# ------------------------------------------------------------------------------
init_wine_layer() {
  if ! command -v wine >/dev/null 2>&1; then
    if [[ -x /etc/sysconfig/tcedir/ondemand/wine ]]; then
      log_info "Wine 10 configured in on-demand mode; skipping eager prefix creation."
    else
      log_info "Wine binary not currently loaded; skipping prefix init."
    fi
    return 0
  fi

  local wine_ver
  wine_ver="$(wine --version 2>/dev/null || echo 'unknown')"
  log_info "Detected runtime: \${wine_ver}"

  if [[ ! -d "\${WINE_PREFIX}/drive_c" ]]; then
    log_info "Initializing Wine 10+ WoW64 prefix silently at \${WINE_PREFIX}..."
    export WINEPREFIX="\${WINE_PREFIX}"
    export WINEARCH="win64"
    export WINENTSYNC=1
    export WINEDLLOVERRIDES="mscoree,mshtml="
    export WINEDEBUG="-all"

    if [[ -z "\${DISPLAY:-}" ]] && command -v xvfb-run >/dev/null 2>&1; then
      xvfb-run -a wineboot --init || true
    else
      wineboot --init || true
    fi
    command -v wineserver >/dev/null 2>&1 && wineserver -w || true
  else
    log_info "Existing Wine prefix detected at \${WINE_PREFIX}."
  fi
}

# ------------------------------------------------------------------------------
# 3. XDG MIME Associations (.exe, .msi, .apk)
# ------------------------------------------------------------------------------
register_mime_associations() {
  log_info "Registering XDG MIME handlers for .exe, .msi, and .apk files..."
  mkdir -p "\${HOME}/.config" "\${HOME}/.local/share/applications"

  if [[ ! -f "\${MIME_LIST}" ]]; then
    cat > "\${MIME_LIST}" <<'EOF'
[Default Applications]
application/x-ms-dos-executable=wine-exe-runner.desktop
application/x-dosexec=wine-exe-runner.desktop
application/x-msdownload=wine-exe-runner.desktop
application/x-msi=wine-exe-runner.desktop
application/vnd.android.package-archive=android-apk-installer.desktop
EOF
  fi

  command -v update-desktop-database >/dev/null 2>&1 && \
    update-desktop-database "\${HOME}/.local/share/applications" >/dev/null 2>&1 || true
  command -v update-mime-database >/dev/null 2>&1 && \
    run_as_root update-mime-database /usr/local/share/mime >/dev/null 2>&1 || true
}

${androidSection}

# ------------------------------------------------------------------------------
# 4. X11 Keyboard Layout (English + Arabic XKB Switching)
# ------------------------------------------------------------------------------
configure_keyboard_layout() {
  local xkb_layout="${resolveXkbLayout(config).layout}"
  local xkb_variant="${resolveXkbLayout(config).variant}"
  local xkb_opt="${config.keyboardToggle}"
  if [[ -n "\${DISPLAY:-}" ]] && command -v setxkbmap >/dev/null 2>&1; then
    setxkbmap -model pc105 -layout "\${xkb_layout}" -variant "\${xkb_variant}" -option "" -option "\${xkb_opt}" 2>/dev/null || true
    log_info "Applied XKB keyboard layout: \${xkb_layout} (toggle: \${xkb_opt})."
  else
    log_info "XKB keyboard target configured: \${xkb_layout} (toggle: \${xkb_opt})."
  fi
}

main() {
  log_info "Starting CorePure64 kernel-integrated compatibility setup (\${1:-manual})..."
  verify_kernel_binfmt
  configure_keyboard_layout
  init_wine_layer
  init_android_layer
  register_mime_associations
  log_info "Compatibility layers configured successfully."
}

main "$@"
`;
}

function generateOpenboxRcXml(config: OsBuildConfig): string {
  const isDark = config.desktopTheme === 'slate-dark';
  const themeName = isDark ? 'Clearlooks-3.4' : 'Clearlooks';
  const marginBottom = config.panelPosition === 'bottom' ? '40' : '4';
  const marginTop = config.panelPosition === 'top' ? '40' : '4';
  const termCmd = config.terminal === 'konsole' ? 'lxterminal' : config.terminal;
  const fmCmd = config.fileManager === 'dolphin' ? 'pcmanfm' : config.fileManager;

  return `<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc" xmlns:xi="http://www.w3.org/2001/XInclude">
  <resistance>
    <strength>10</strength>
    <screen_edge_strength>20</screen_edge_strength>
  </resistance>
  <focus>
    <focusNew>yes</focusNew>
    <followMouse>no</followMouse>
    <focusLast>yes</focusLast>
    <raiseOnFocus>no</raiseOnFocus>
  </focus>
  <placement>
    <policy>Smart</policy>
    <center>yes</center>
    <monitor>Primary</monitor>
  </placement>
  <theme>
    <name>${themeName}</name>
    <titleLayout>NLIMC</titleLayout>
    <keepBorder>yes</keepBorder>
    <animateIconify>yes</animateIconify>
    <font place="ActiveWindow">
      <name>DejaVu Sans</name>
      <size>10</size>
      <weight>Bold</weight>
      <slant>Normal</slant>
    </font>
    <font place="InactiveWindow">
      <name>DejaVu Sans</name>
      <size>10</size>
      <weight>Normal</weight>
      <slant>Normal</slant>
    </font>
  </theme>
  <desktops>
    <number>2</number>
    <firstdesk>1</firstdesk>
    <names>
      <name>Workspace 1</name>
      <name>Workspace 2</name>
    </names>
  </desktops>
  <margins>
    <top>${marginTop}</top>
    <bottom>${marginBottom}</bottom>
    <left>4</left>
    <right>4</right>
  </margins>
  <keyboard>
    <keybind key="W-space">
      <action name="Execute"><command>rofi -show drun</command></action>
    </keybind>
    <keybind key="A-F2">
      <action name="Execute"><command>rofi -show run</command></action>
    </keybind>
    <keybind key="W-Return">
      <action name="Execute"><command>${termCmd}</command></action>
    </keybind>
    <keybind key="W-e">
      <action name="Execute"><command>${fmCmd}</command></action>
    </keybind>
    <keybind key="A-F4">
      <action name="Close"/>
    </keybind>
    <keybind key="A-Tab">
      <action name="NextWindow"/>
    </keybind>
    <keybind key="W-Left">
      <action name="UnmaximizeFull"/>
      <action name="MoveResizeTo"><x>0</x><y>0</y><width>50%</width><height>100%</height></action>
    </keybind>
    <keybind key="W-Right">
      <action name="UnmaximizeFull"/>
      <action name="MoveResizeTo"><x>50%</x><y>0</y><width>50%</width><height>100%</height></action>
    </keybind>
    <keybind key="W-Up">
      <action name="ToggleMaximize"/>
    </keybind>
  </keyboard>
  <mouse>
    <context name="Desktop">
      <mousebind button="Right" action="Press">
        <action name="ShowMenu"><menu>root-menu</menu></action>
      </mousebind>
    </context>
  </mouse>
</openbox_config>
`;
}

function generateOpenboxAutostart(config: OsBuildConfig): string {
  const bgColor = config.desktopTheme === 'slate-dark' ? '#0f172a' : '#f1f5f9';
  const xkb = resolveXkbLayout(config);
  return `#!/bin/sh
# Openbox Desktop Session Autostart for CorePure64

# Apply English (primary) + Arabic (secondary) XKB keyboard layout (${xkb.toggleLabel})
command -v setxkbmap >/dev/null 2>&1 && setxkbmap -model pc105 -layout "${xkb.layout}" -variant "${xkb.variant}" -option "" -option "${config.keyboardToggle}" &

xrdb -merge <<'XRDB'
Xft.dpi: 96
Xft.antialias: 1
Xft.hinting: 1
Xft.hintstyle: hintslight
Xft.rgba: rgb
XRDB

if [ -f /usr/local/share/wallpapers/corepure64.jpg ] && command -v feh >/dev/null 2>&1; then
  feh --bg-fill /usr/local/share/wallpapers/corepure64.jpg &
elif command -v xsetroot >/dev/null 2>&1; then
  xsetroot -solid "${bgColor}" &
fi

command -v pulseaudio >/dev/null 2>&1 && pulseaudio --start --exit-idle-time=-1 &
command -v tint2 >/dev/null 2>&1 && tint2 -c "$HOME/.config/tint2/tint2rc" &

(sleep 1 && command -v volumeicon >/dev/null 2>&1 && volumeicon) &
(sleep 1 && command -v nm-applet >/dev/null 2>&1 && nm-applet) &

if [ -x /usr/local/bin/setup_compat_layers.sh ]; then
  /usr/local/bin/setup_compat_layers.sh --x11-session >/tmp/compat-session.log 2>&1 &
fi
`;
}

function generateOpenboxMenuXml(config: OsBuildConfig): string {
  const browserCmd = config.browser === 'firefox-esr' ? 'firefox' : config.browser;
  const termCmd = config.terminal;
  const fmCmd = config.fileManager;
  const xkb = resolveXkbLayout(config);
  return `<?xml version="1.0" encoding="UTF-8"?>
<openbox_menu xmlns="http://openbox.org/3.4/menu">
  <menu id="root-menu" label="CorePure64">
    <item label="Applications (Rofi)">
      <action name="Execute"><command>rofi -show drun</command></action>
    </item>
    <item label="Switch to KDE Plasma Lite">
      <action name="Execute"><command>startplasma-lite</command></action>
    </item>
    <separator />
    <item label="Terminal">
      <action name="Execute"><command>${termCmd}</command></action>
    </item>
    <item label="File Manager">
      <action name="Execute"><command>${fmCmd}</command></action>
    </item>
    <item label="Web Browser">
      <action name="Execute"><command>${browserCmd}</command></action>
    </item>
    <item label="System Monitor (htop)">
      <action name="Execute"><command>${termCmd} -e htop</command></action>
    </item>
    <separator />
    <menu id="keyboard-menu" label="Keyboard Layout (${xkb.names})">
      <item label="English (Primary) + Arabic (Secondary) [${xkb.toggleLabel}]">
        <action name="Execute"><command>setxkbmap -model pc105 -layout "us,ara" -variant "," -option "" -option "${config.keyboardToggle}"</command></action>
      </item>
      <item label="English Only (us)">
        <action name="Execute"><command>setxkbmap -model pc105 -layout "us" -option ""</command></action>
      </item>
    </menu>
    <menu id="compat-menu" label="Compatibility Layers">
      <item label="Run Windows EXE (Wine 10)">
        <action name="Execute"><command>/usr/local/bin/wine-exe-runner</command></action>
      </item>
      <item label="Wine Configuration (winecfg)">
        <action name="Execute"><command>winecfg</command></action>
      </item>
      <item label="Launch Android Desktop">
        <action name="Execute"><command>/usr/local/bin/android-apk-runner</command></action>
      </item>
    </menu>
    <separator />
    <item label="Reconfigure Openbox">
      <action name="Reconfigure"/>
    </item>
    <item label="Exit Session">
      <action name="Exit"/>
    </item>
  </menu>
</openbox_menu>
`;
}

function generateTint2rc(config: OsBuildConfig): string {
  const isDark = config.desktopTheme === 'slate-dark';
  const panelBg = isDark ? '#0f172a 92' : '#f8fafc 95';
  const panelBorder = isDark ? '#334155 100' : '#cbd5e1 100';
  const activeTaskBg = isDark ? '#1e293b 100' : '#e2e8f0 100';
  const activeTaskBorder = isDark ? '#38bdf8 100' : '#0284c7 100';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#475569';
  const pos = config.panelPosition === 'bottom' ? 'bottom center horizontal' : 'top center horizontal';

  return `# Tint2 Panel Configuration — CorePure64 (${config.desktopTheme})
rounded = 0
border_width = 1
background_color = ${panelBg}
border_color = ${panelBorder}

rounded = 4
border_width = 0
border_bottom_width = 2
background_color = ${activeTaskBg}
border_color = ${activeTaskBorder}

panel_items = LTSC
panel_size = 100% 36
panel_margin = 0 0
panel_padding = 8 4 8
panel_background_id = 1
panel_position = ${pos}
panel_layer = top
panel_monitor = all
strut_policy = follow_size
autohide = 0

launcher_padding = 6 2 6
launcher_background_id = 0
launcher_icon_theme = Papirus
launcher_icon_size = 20
launcher_item_app = /usr/local/share/applications/wine-exe-runner.desktop
launcher_item_app = /usr/local/share/applications/android-waydroid-session.desktop

taskbar_mode = single_desktop
taskbar_padding = 4 2 4
taskbar_background_id = 0
taskbar_active_background_id = 0
task_icon = 1
task_text = 1
task_maximum_size = 180 28
task_padding = 8 4 6
task_font = DejaVu Sans 9
task_font_color = ${textMuted} 100
task_active_font_color = ${textPrimary} 100
task_active_background_id = 2

systray_padding = 6 2 6
systray_background_id = 0
systray_sort = ascending
systray_icon_size = 18
systray_icon_asb = 100 0 0

time1_format = %H:%M
time1_font = DejaVu Sans Bold 10
time2_format = %Y-%m-%d
time2_font = DejaVu Sans 8
clock_font_color = ${textPrimary} 100
clock_padding = 8 2
clock_lclick_command = ${config.terminal} -e cal
`;
}

function generateRofiConfig(config: OsBuildConfig): string {
  const isDark = config.desktopTheme === 'slate-dark';
  const bg = isDark ? '#0f172af0' : '#fffffff2';
  const fg = isDark ? '#f8fafc' : '#0f172a';
  const border = isDark ? '#334155' : '#cbd5e1';
  const accent = isDark ? '#0284c7' : '#0369a1';
  const rowAlt = isDark ? '#1e293b' : '#f1f5f9';

  return `configuration {
  modi: "drun,run,window";
  show-icons: true;
  icon-theme: "Papirus";
  font: "DejaVu Sans 11";
  drun-display-format: "{name}";
  terminal: "${config.terminal}";
}

* {
  bg: ${bg};
  fg: ${fg};
  border-col: ${border};
  accent: ${accent};
  row-alt: ${rowAlt};
  background-color: transparent;
  text-color: @fg;
}

window {
  width: 540px;
  background-color: @bg;
  border: 1px solid;
  border-color: @border-col;
  border-radius: 8px;
  padding: 16px;
}

inputbar {
  children: [prompt, entry];
  padding: 8px 12px;
  background-color: @row-alt;
  border-radius: 6px;
  margin: 0 0 12px 0;
}

prompt {
  margin: 0 8px 0 0;
  text-color: @accent;
}

listview {
  lines: 8;
  scrollbar: false;
}

element {
  padding: 8px 10px;
  border-radius: 6px;
}

element selected {
  background-color: @accent;
  text-color: #ffffff;
}
`;
}

function generateKdeGlobals(config: OsBuildConfig): string {
  const isDark = config.desktopTheme === 'slate-dark';
  return `[General]
ColorScheme=${isDark ? 'BreezeDark' : 'BreezeLight'}
Name=Breeze
widgetStyle=Breeze
font=DejaVu Sans,10,-1,5,50,0,0,0,0,0
fixed=IBM Plex Mono,10,-1,5,50,0,0,0,0,0

[Icons]
Theme=breeze${isDark ? '-dark' : ''}

[KDE]
AnimationDurationFactor=0.5
LookAndFeelPackage=${isDark ? 'org.kde.breezedark.desktop' : 'org.kde.breeze.desktop'}
SingleClick=false
`;
}

function generateKwinRc(): string {
  return `[Compositing]
AnimationSpeed=3
Backend=OpenGL
Enabled=true
GLCore=false
LatencyPolicy=Low
OpenGLIsUnsafe=false
WindowsBlockCompositing=true

[Effect-Blur]
BlurStrength=5

[Windows]
Placement=Smart
FocusPolicy=ClickToFocus
`;
}

function generateBalooRc(): string {
  return `[Basic Settings]
Indexing-Enabled=false

[General]
first run=false
`;
}

function generateKdeKxkbRc(config: OsBuildConfig): string {
  const xkb = resolveXkbLayout(config);
  return `[Layout]
DisplayNames=${xkb.names}
LayoutList=${xkb.layout}
VariantList=${xkb.variant}
LayoutLoopCount=-1
Model=pc105
Options=${config.keyboardToggle}
ResetOldOptions=true
ShowFlag=false
ShowLabel=true
ShowLayoutIndicator=true
ShowSingle=false
SwitchMode=Global
Use=true
`;
}

function generateGtkSettings(config: OsBuildConfig): string {
  const isDark = config.desktopTheme === 'slate-dark';
  return `[Settings]
gtk-theme-name=Adwaita
gtk-icon-theme-name=Papirus
gtk-font-name=DejaVu Sans 10
gtk-application-prefer-dark-theme=${isDark ? '1' : '0'}
gtk-xft-antialias=1
gtk-xft-hinting=1
gtk-xft-hintstyle=hintslight
`;
}

function generateWineDesktopEntry(): string {
  return `[Desktop Entry]
Name=Windows EXE Runner (Wine 10)
Comment=Execute 32-bit & 64-bit Windows .exe and .msi binaries natively via Wine 10 WoW64
Exec=/usr/local/bin/wine-exe-runner %f
Icon=wine
Terminal=false
Type=Application
Categories=System;Emulator;
MimeType=application/x-ms-dos-executable;application/x-dosexec;application/x-msdownload;application/x-msi;
`;
}

function generateAndroidApkDesktopEntry(): string {
  return `[Desktop Entry]
Name=Android APK Installer
Comment=Install and launch Android .apk packages seamlessly
Exec=/usr/local/bin/android-apk-runner %f
Icon=android-studio
Terminal=false
Type=Application
Categories=System;Emulator;
MimeType=application/vnd.android.package-archive;
`;
}

function generateAndroidSessionDesktopEntry(config: OsBuildConfig): string {
  const label =
    config.androidRuntime === 'waydroid-cage'
      ? 'Android Desktop (Waydroid)'
      : 'Android Micro-VM (QEMU)';
  return `[Desktop Entry]
Name=${label}
Comment=Launch containerized Android environment inside X11
Exec=/usr/local/bin/android-apk-runner
Icon=phone
Terminal=false
Type=Application
Categories=System;Emulator;
`;
}

function generateMimeAppsList(): string {
  return `[Default Applications]
application/x-ms-dos-executable=wine-exe-runner.desktop
application/x-dosexec=wine-exe-runner.desktop
application/x-msdownload=wine-exe-runner.desktop
application/x-msi=wine-exe-runner.desktop
application/vnd.android.package-archive=android-apk-installer.desktop
`;
}

function generateBuildAndTestGuide(config: OsBuildConfig): string {
  return `# Step-by-Step Build & Test Guide (x86 + x86_64 -> QEMU/VirtualBox)

## 1. Host Prerequisites (Ubuntu / Debian)

Install all required ISO authoring, SquashFS, Syslinux BIOS, dual-arch GRUB2 UEFI (x86_64 + IA32), and kernel build tools:

\`\`\`bash
sudo apt-get update
sudo apt-get install -y \\
  curl xorriso squashfs-tools mmdebstrap \\
  isolinux syslinux-common \\
  grub-efi-amd64-bin grub-efi-ia32-bin grub-pc-bin \\
  dosfstools mtools cpio gzip \\
  build-essential bc bison flex libssl-dev libelf-dev
\`\`\`

---

## 2. Build the Dual-Arch Hybrid ISO (with Optional Custom Kernel)

\`\`\`bash
chmod +x build_iso.sh setup_compat_layers.sh

# Standard build (remasters initrd with binfmt_misc + binderfs + Wine 10 WoW64 + Plasma Lite):
./build_iso.sh

# Full custom kernel compilation (Linux 6.14+ LTS with built-in =y BinderFS, NTSync, IA32 & binfmt_misc):
BUILD_KERNEL=true ./build_iso.sh
\`\`\`

---

## 3. Test in QEMU / KVM (x86_64 & 32-bit x86)

### A. x86_64 UEFI Mode (OVMF Firmware + KVM)
\`\`\`bash
qemu-system-x86_64 \\
  -enable-kvm -cpu host -m 2048 -smp 2 \\
  -bios /usr/share/ovmf/OVMF.fd \\
  -vga virtio -display gtk,gl=on \\
  -device virtio-net-pci,netdev=net0 -netdev user,id=net0 \\
  -cdrom "./dist/${config.isoName}" \\
  -boot d
\`\`\`

### B. x86_64 Legacy BIOS Mode (KVM)
\`\`\`bash
qemu-system-x86_64 \\
  -enable-kvm -cpu host -m 2048 -smp 2 \\
  -vga vmware -display gtk \\
  -device e1000,netdev=net0 -netdev user,id=net0 \\
  -cdrom "./dist/${config.isoName}" \\
  -boot d
\`\`\`

### C. 32-bit x86 Architecture Verification (QEMU i386)
\`\`\`bash
qemu-system-i386 \\
  -cpu pentium3 -m 1024 -smp 1 \\
  -vga std -display gtk \\
  -device e1000,netdev=net0 -netdev user,id=net0 \\
  -cdrom "./dist/${config.isoName}" \\
  -boot d
\`\`\`

---

## 4. Verify Kernel-Level Wine 10 & Direct APK Support Inside Booted OS

\`\`\`bash
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
\`\`\`
`;
}

export function generateAllArtifacts(config: OsBuildConfig): GeneratedArtifact[] {
  const estimate = calculateResourceEstimate(config);

  return [
    {
      path: 'architecture_overview.md',
      category: 'docs',
      language: 'markdown',
      summary: 'Dual x86/x86_64 directory layout, kernel-embedded binfmt_misc/binderfs/ntsync, and Wine 10 + Android architecture.',
      content: generateArchitectureOverview(config, estimate),
    },
    {
      path: 'build_iso.sh',
      category: 'scripts',
      language: 'bash',
      summary: 'Automated x86 + x86_64 hybrid ISO builder with custom kernel option, Wine 10+ WoW64, KDE Plasma Lite, and BIOS+UEFI boot.',
      content: generateBuildIsoScript(config),
    },
    {
      path: 'setup_compat_layers.sh',
      category: 'scripts',
      language: 'bash',
      summary: 'Verifies kernel binfmt_misc (MZ/APK), initializes Wine 10+ WoW64 prefix, and configures Android APK runner.',
      content: generateSetupCompatScript(config),
    },
    {
      path: 'kernel_configs/corepure64-android-wine.config',
      category: 'kernel',
      language: 'ini',
      summary: 'Linux 6.14+ LTS kernel config fragment compiling BinderFS, NTSync, IA32_EMULATION, and binfmt_misc (=y).',
      content: generateKernelConfigFragment(config),
    },
    {
      path: 'BUILD_AND_TEST.md',
      category: 'docs',
      language: 'markdown',
      summary: 'Host toolchain, BUILD_KERNEL=true compile, QEMU x86_64 + i386 boot, and in-OS verification commands.',
      content: generateBuildAndTestGuide(config),
    },
    {
      path: 'ui_configs/kde-plasma/kdeglobals',
      category: 'ui_configs',
      language: 'ini',
      summary: 'KDE Plasma Lite Breeze theme, font rendering, and lightweight animation settings.',
      content: generateKdeGlobals(config),
    },
    {
      path: 'ui_configs/kde-plasma/kwinrc',
      category: 'ui_configs',
      language: 'ini',
      summary: 'KWin-X11 low-latency OpenGL compositor and smart window placement rules.',
      content: generateKwinRc(),
    },
    {
      path: 'ui_configs/kde-plasma/baloofilerc',
      category: 'ui_configs',
      language: 'ini',
      summary: 'Disables Baloo background file indexing to preserve low RAM and CPU overhead.',
      content: generateBalooRc(),
    },
    {
      path: 'ui_configs/kde-plasma/kxkbrc',
      category: 'ui_configs',
      language: 'ini',
      summary: 'KDE Plasma keyboard layout switcher enabling English (us) + Arabic (ara) tray toggle.',
      content: generateKdeKxkbRc(config),
    },
    {
      path: 'ui_configs/openbox/rc.xml',
      category: 'ui_configs',
      language: 'xml',
      summary: 'Openbox window manager rules, panel margins, and keyboard snapping shortcuts.',
      content: generateOpenboxRcXml(config),
    },
    {
      path: 'ui_configs/openbox/autostart',
      category: 'ui_configs',
      language: 'bash',
      summary: 'X11 session startup: Xft DPI, Feh wallpaper, PulseAudio, Tint2, and tray applets.',
      content: generateOpenboxAutostart(config),
    },
    {
      path: 'ui_configs/openbox/menu.xml',
      category: 'ui_configs',
      language: 'xml',
      summary: 'Desktop right-click menu with Plasma Lite switch, Rofi, utilities, Wine 10, and Android.',
      content: generateOpenboxMenuXml(config),
    },
    {
      path: 'ui_configs/tint2/tint2rc',
      category: 'ui_configs',
      language: 'ini',
      summary: 'Sleek taskbar, system tray, Papirus launcher, and clock configuration.',
      content: generateTint2rc(config),
    },
    {
      path: 'ui_configs/rofi/config.rasi',
      category: 'ui_configs',
      language: 'css',
      summary: 'Keyboard application launcher theme matching the active desktop palette.',
      content: generateRofiConfig(config),
    },
    {
      path: 'ui_configs/gtk-3.0/settings.ini',
      category: 'ui_configs',
      language: 'ini',
      summary: 'GTK3 theme, Papirus icon pack, and subpixel font rendering configuration.',
      content: generateGtkSettings(config),
    },
    {
      path: 'ui_configs/applications/wine-exe-runner.desktop',
      category: 'desktop',
      language: 'ini',
      summary: 'Desktop entry registering .exe and .msi double-click execution with Wine 10.',
      content: generateWineDesktopEntry(),
    },
    {
      path: 'ui_configs/applications/android-apk-installer.desktop',
      category: 'desktop',
      language: 'ini',
      summary: 'Desktop entry registering .apk one-click installation and execution.',
      content: generateAndroidApkDesktopEntry(),
    },
    {
      path: 'ui_configs/applications/android-waydroid-session.desktop',
      category: 'desktop',
      language: 'ini',
      summary: 'Desktop launcher for opening the full Android desktop container.',
      content: generateAndroidSessionDesktopEntry(config),
    },
    {
      path: 'ui_configs/mimeapps.list',
      category: 'desktop',
      language: 'ini',
      summary: 'XDG MIME defaults binding .exe, .msi, and .apk files to compatibility runners.',
      content: generateMimeAppsList(),
    },
  ];
}
