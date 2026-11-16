import { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import { OsBuildConfig } from '../os/types';

interface GuideViewProps {
  config: OsBuildConfig;
}

interface CommandStep {
  id: string;
  title: string;
  description: string;
  command: string;
}

export function GuideView({ config }: GuideViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const steps: CommandStep[] = [
    {
      id: 'deps',
      title: '01. Install Host Build Toolchain (Ubuntu / Debian)',
      description:
        'Installs xorriso, SquashFS tools, Syslinux BIOS, both 64-bit & 32-bit GRUB2 EFI binaries, and mmdebstrap for Wine 10+ WoW64 & Plasma Lite.',
      command: `sudo apt-get update && sudo apt-get install -y \\
  curl xorriso squashfs-tools \\
  isolinux syslinux-common \\
  grub-efi-amd64-bin grub-efi-ia32-bin grub-pc-bin \\
  dosfstools mtools cpio gzip mmdebstrap \\
  build-essential flex bison bc libelf-dev libssl-dev`,
    },
    {
      id: 'build',
      title: '02. Run Automated Dual-Arch Hybrid ISO Build',
      description:
        'Packages x86 + x86_64 cores, Wine 10+ WoW64, Waydroid/Cage, remasters initrds with binfmt_misc & binderfs hooks, and outputs the hybrid ISO. Set BUILD_KERNEL=true to compile Linux 6.14+ from kernel_configs/corepure64-android-wine.config.',
      command: `chmod +x build_iso.sh setup_compat_layers.sh
./build_iso.sh
# Optional: compile custom BinderFS + NTSYNC + binfmt_misc kernel inline:
# BUILD_KERNEL=true ./build_iso.sh`,
    },
    {
      id: 'verify-iso',
      title: '03. Verify El Torito BIOS + UEFI Hybrid Records',
      description:
        'Confirms the generated ISO exposes legacy BIOS boot entries and dual x64/ia32 GPT EFI System Partition loaders.',
      command: `xorriso -indev "./dist/${config.isoName}" -toc -pvd_info
fdisk -l "./dist/${config.isoName}"`,
    },
    {
      id: 'qemu-x64',
      title: '04. Test x86_64 Mode in QEMU / KVM (UEFI OVMF + VirtIO GL)',
      description:
        'Boots the 64-bit CorePure64 target under UEFI firmware with KVM acceleration, 2 GB RAM, and VirtIO OpenGL graphics.',
      command: `qemu-system-x86_64 \\
  -enable-kvm -cpu host -m 2048 -smp 2 \\
  -bios /usr/share/ovmf/OVMF.fd \\
  -vga virtio -display gtk,gl=on \\
  -device virtio-net-pci,netdev=net0 -netdev user,id=net0 \\
  -cdrom "./dist/${config.isoName}" \\
  -boot d`,
    },
    {
      id: 'qemu-x86',
      title: '05. Test 32-bit x86 Mode & Legacy BIOS in QEMU',
      description:
        'Validates automatic 32-bit core.gz selection via ISOLINUX ifcpu64.c32 / GRUB2 cpuid -l on x86-only hardware.',
      command: `qemu-system-i386 \\
  -m 1536 -smp 2 \\
  -vga vmware -display gtk \\
  -device e1000,netdev=net0 -netdev user,id=net0 \\
  -cdrom "./dist/${config.isoName}" \\
  -boot d`,
    },
    {
      id: 'verify-in-os',
      title: '06. Verify Wine 10+, BinderFS, Arabic Keyboard & binfmt_misc',
      description:
        'Run inside the live OS terminal to confirm Wine 10+ WoW64, /dev/binderfs, /dev/ntsync, Arabic (ara) XKB layout, and direct .exe/.apk execution.',
      command: `wine --version
setxkbmap -query
ls -l /dev/binderfs /dev/ntsync
cat /proc/sys/fs/binfmt_misc/DOSWin
cat /proc/sys/fs/binfmt_misc/AndroidAPK
./setup_compat_layers.sh --dry-test`,
    },
    {
      id: 'vbox',
      title: '07. Test in VirtualBox (EFI + VMSVGA)',
      description:
        'Creates and launches a hardware-accelerated VirtualBox VM configured with VMSVGA graphics and EFI boot.',
      command: `VM_NAME="CorePure64_Test"
VBoxManage createvm --name "$VM_NAME" --ostype "Linux_64" --register
VBoxManage modifyvm "$VM_NAME" --memory 2048 --cpus 2 --vram 64 --graphicscontroller vmsvga --firmware efi
VBoxManage storagectl "$VM_NAME" --name "IDE" --add ide
VBoxManage storageattach "$VM_NAME" --storagectl "IDE" --port 0 --device 0 --type dvddrive --medium "$(pwd)/dist/${config.isoName}"
VBoxManage startvm "$VM_NAME"`,
    },
  ];

  const handleCopy = async (id: string, cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Step-by-Step Build &amp; Virtual Machine Test Guide
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Execute these verified host commands on Ubuntu/Debian to compile <span className="font-mono">{config.isoName}</span> and validate BIOS + UEFI boot paths.
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <section
            key={step.id}
            className="bg-white border border-slate-200 rounded-lg overflow-hidden"
          >
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{step.title}</h2>
                <p className="text-xs text-slate-600 mt-0.5">{step.description}</p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(step.id, step.command)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
              >
                {copiedId === step.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    Copy Commands
                  </>
                )}
              </button>
            </div>
            <div className="bg-slate-950 px-5 py-3.5 flex items-start gap-3">
              <Terminal className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
              <pre className="text-xs leading-relaxed font-mono text-sky-200 overflow-x-auto flex-1">
                <code>{step.command}</code>
              </pre>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
