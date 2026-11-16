import { useState } from 'react';
import { AppWindow, Check, Copy, Smartphone } from 'lucide-react';
import { OsBuildConfig, ResourceEstimate } from '../os/types';

interface CompatLayersViewProps {
  config: OsBuildConfig;
  estimate: ResourceEstimate;
  setupScriptContent: string;
}

const MIME_MATRIX = [
  {
    extension: '.exe',
    mimeType: 'application/x-ms-dos-executable · application/x-dosexec',
    desktopEntry: 'wine-exe-runner.desktop',
    executor: '/usr/local/bin/wine-exe-runner %f',
  },
  {
    extension: '.msi',
    mimeType: 'application/x-msi',
    desktopEntry: 'wine-exe-runner.desktop',
    executor: 'wine msiexec /i %f',
  },
  {
    extension: '.apk',
    mimeType: 'application/vnd.android.package-archive',
    desktopEntry: 'android-apk-installer.desktop',
    executor: '/usr/local/bin/android-apk-runner %f',
  },
];

export function CompatLayersView({
  config,
  estimate,
  setupScriptContent,
}: CompatLayersViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(setupScriptContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Windows 10+ (Wine WoW64) &amp; Android (.apk) Kernel Compatibility
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Direct kernel <span className="font-mono">binfmt_misc</span> execution plus zero-configuration GUI MIME dispatch initialized by <span className="font-mono">setup_compat_layers.sh</span>.
        </p>
      </div>

      {/* Two side-by-side layer cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <AppWindow className="w-5 h-5 text-sky-700" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Windows Layer ({config.wineVersion === 'wine-10-staging' ? 'Wine 10+ Staging' : 'Wine 10+ WoW64'})
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {config.includeWine ? `${estimate.wineSquashfsMb} MB SquashFS` : 'Disabled'}
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Packages <span className="font-mono">{config.wineVersion === 'wine-10-staging' ? 'wine10-staging-wow64.tcz' : 'wine10-wow64.tcz'}</span> from WineHQ with <span className="font-mono">WINENTSYNC=1</span> and <span className="font-mono">CONFIG_IA32_EMULATION=y</span> so both 32-bit and 64-bit <span className="font-mono">.exe</span>/<span className="font-mono">.msi</span> binaries execute natively via <span className="font-mono">DOSWin</span> <span className="font-mono">binfmt_misc</span> or double-click.
            </p>

            <dl className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-500">Load Policy</dt>
                <dd className="mt-0.5 font-mono font-medium text-slate-900">
                  {config.embedCompatInCore ? 'Core Initrd + onboot.lst' : config.wineOnDemand ? 'cde/ondemand/wine10' : 'cde/onboot.lst (loop)'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Active RAM Footprint</dt>
                <dd className="mt-0.5 font-mono font-medium text-slate-900 tabular-nums">
                  ~{estimate.wineActiveRamMb} MB total
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-sky-700" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Android Layer ({config.androidRuntime === 'waydroid-cage' ? 'Waydroid + BinderFS' : 'QEMU Micro-VM'})
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {estimate.androidImageMb} MB SquashFS
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {config.androidRuntime === 'waydroid-cage'
                ? 'Compiles CONFIG_ANDROID_BINDER_IPC=y and CONFIG_ANDROID_BINDERFS=y directly into the kernel, auto-mounts /dev/binderfs in bootlocal.sh, and registers AndroidAPK in binfmt_misc so .apk packages install and launch inside Cage + Waydroid.'
                : 'Boots a lightweight hardware-accelerated QEMU-KVM Android-x86 micro-VM with VirtIO GPU and forwards ADB port 5555 so executing or double-clicking any .apk runs adb install seamlessly.'}
            </p>

            <dl className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-500">Kernel &amp; Isolation</dt>
                <dd className="mt-0.5 font-mono font-medium text-slate-900">
                  {config.androidRuntime === 'waydroid-cage' ? 'BinderFS (=y) + Cage LXC' : 'KVM + VirtIO-GL'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Active RAM Footprint</dt>
                <dd className="mt-0.5 font-mono font-medium text-slate-900 tabular-nums">
                  ~{estimate.androidActiveRamMb} MB total
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      {/* XDG MIME Association Matrix */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Kernel <span className="font-mono text-sm">binfmt_misc</span> &amp; XDG MIME Execution Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bound in <span className="font-mono">/proc/sys/fs/binfmt_misc/</span> (DOSWin &amp; AndroidAPK) and <span className="font-mono">/etc/skel/.config/mimeapps.list</span> for Dolphin, PCManFM, and Thunar.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-5">File Type</th>
                <th className="py-2.5 px-4">Registered MIME Types</th>
                <th className="py-2.5 px-4">Desktop Handler</th>
                <th className="py-2.5 px-5">Executed Command</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {MIME_MATRIX.map((row) => (
                <tr key={row.extension} className="hover:bg-slate-50/70">
                  <td className="py-3 px-5 font-mono font-semibold text-slate-900">{row.extension}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{row.mimeType}</td>
                  <td className="py-3 px-4 font-mono text-sky-700">{row.desktopEntry}</td>
                  <td className="py-3 px-5 font-mono text-slate-700">{row.executor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* setup_compat_layers.sh Script Inspector */}
      <section className="bg-slate-950 text-slate-100 rounded-lg border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-white font-mono">setup_compat_layers.sh</h3>
            <p className="text-xs text-slate-400">
              Silent Wine64 initialization, XDG MIME registration, and Android APK runner wrapper
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                Copy Script
              </>
            )}
          </button>
        </div>
        <pre className="p-4 text-xs leading-relaxed font-mono overflow-x-auto max-h-[480px] overflow-y-auto text-slate-200">
          <code>{setupScriptContent}</code>
        </pre>
      </section>
    </div>
  );
}
