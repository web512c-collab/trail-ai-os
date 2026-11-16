import { useState } from 'react';
import { AlertTriangle, Check, Copy, RotateCcw } from 'lucide-react';
import {
  DEFAULT_OS_CONFIG,
  OsBuildConfig,
  ResourceEstimate,
  ValidationIssue,
} from '../os/types';

interface ConfiguratorViewProps {
  config: OsBuildConfig;
  onChange: (next: OsBuildConfig) => void;
  estimate: ResourceEstimate;
  issues: ValidationIssue[];
  xorissoCommand: string;
  buildScriptContent: string;
}

export function ConfiguratorView({
  config,
  onChange,
  estimate,
  issues,
  xorissoCommand,
  buildScriptContent,
}: ConfiguratorViewProps) {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const issueFor = (field: keyof OsBuildConfig) =>
    issues.find((i) => i.field === field)?.message;

  const handleCopy = async (text: string, which: 'cmd' | 'script') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'cmd') {
        setCopiedCmd(true);
        setTimeout(() => setCopiedCmd(false), 1800);
      } else {
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 1800);
      }
    } catch {
      // Clipboard API unavailable in restricted frames
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            ISO Profile &amp; Build Script Configurator
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Adjust target release, desktop packages, compatibility layers, and bootloader parameters. Changes regenerate all scripts live.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_OS_CONFIG)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Reset Defaults
        </button>
      </div>

      {issues.length > 0 && (
        <div
          role="alert"
          className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3 text-sm text-amber-950"
        >
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium">Configuration validation requires attention</p>
            <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
              {issues.map((issue) => (
                <li key={issue.field}>{issue.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Form Controls */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {/* Base & Bootloader */}
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">01. Base System &amp; ISO Identity</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-tc-version" className="block text-xs font-medium text-slate-700 mb-1">
                  Tiny Core Release
                </label>
                <select
                  id="cfg-tc-version"
                  value={config.tcVersion}
                  onChange={(e) => onChange({ ...config, tcVersion: e.target.value as OsBuildConfig['tcVersion'] })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="15.x">Tiny Core 15.x (Stable)</option>
                  <option value="16.x">Tiny Core 16.x (Latest)</option>
                </select>
              </div>

              <div>
                <label htmlFor="cfg-arch" className="block text-xs font-medium text-slate-700 mb-1">
                  Target CPU Architecture
                </label>
                <select
                  id="cfg-arch"
                  value={config.targetArch}
                  onChange={(e) => onChange({ ...config, targetArch: e.target.value as OsBuildConfig['targetArch'] })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="dual-x86-x86_64">Dual x86 + x86_64 Hybrid ISO</option>
                  <option value="x86_64">x86_64 (64-bit CorePure64 Only)</option>
                  <option value="x86">x86 (32-bit Legacy Core Only)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="cfg-hostname" className="block text-xs font-medium text-slate-700 mb-1">
                System Hostname
              </label>
              <input
                id="cfg-hostname"
                type="text"
                value={config.hostname}
                onChange={(e) => onChange({ ...config, hostname: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              {issueFor('hostname') && (
                <p className="mt-1 text-xs text-red-600">{issueFor('hostname')}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-iso-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Output ISO Filename
                </label>
                <input
                  id="cfg-iso-name"
                  type="text"
                  value={config.isoName}
                  onChange={(e) => onChange({ ...config, isoName: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
                {issueFor('isoName') && (
                  <p className="mt-1 text-xs text-red-600">{issueFor('isoName')}</p>
                )}
              </div>

              <div>
                <label htmlFor="cfg-volid" className="block text-xs font-medium text-slate-700 mb-1">
                  ISO9660 Volume ID
                </label>
                <input
                  id="cfg-volid"
                  type="text"
                  value={config.volumeId}
                  onChange={(e) => onChange({ ...config, volumeId: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
                {issueFor('volumeId') && (
                  <p className="mt-1 text-xs text-red-600">{issueFor('volumeId')}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="cfg-persist-label" className="block text-xs font-medium text-slate-700 mb-1">
                Persistent TCE Partition Label
              </label>
              <input
                id="cfg-persist-label"
                type="text"
                value={config.persistenceLabel}
                onChange={(e) => onChange({ ...config, persistenceLabel: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              {issueFor('persistenceLabel') && (
                <p className="mt-1 text-xs text-red-600">{issueFor('persistenceLabel')}</p>
              )}
            </div>
          </div>

          {/* Desktop Environment & Apps */}
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">02. Desktop Environment &amp; Essential Apps</h2>

            <div>
              <label htmlFor="cfg-de" className="block text-xs font-medium text-slate-700 mb-1">
                Desktop Environment Stack
              </label>
              <select
                id="cfg-de"
                value={config.desktopEnvironment}
                onChange={(e) => onChange({ ...config, desktopEnvironment: e.target.value as OsBuildConfig['desktopEnvironment'] })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
              >
                <option value="dual-plasma-openbox">KDE Plasma Lite + Openbox Fallback (Recommended)</option>
                <option value="kde-plasma-lite">KDE Plasma Lite (KWin + Breeze)</option>
                <option value="openbox-tint2">Openbox + Tint2 + Rofi (Ultra-Light)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-theme" className="block text-xs font-medium text-slate-700 mb-1">
                  UI Color Theme
                </label>
                <select
                  id="cfg-theme"
                  value={config.desktopTheme}
                  onChange={(e) => onChange({ ...config, desktopTheme: e.target.value as OsBuildConfig['desktopTheme'] })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="slate-dark">Slate / Breeze Dark</option>
                  <option value="paper-light">Paper / Breeze Light</option>
                </select>
              </div>

              <div>
                <label htmlFor="cfg-panel" className="block text-xs font-medium text-slate-700 mb-1">
                  Taskbar Edge
                </label>
                <select
                  id="cfg-panel"
                  value={config.panelPosition}
                  onChange={(e) => onChange({ ...config, panelPosition: e.target.value as OsBuildConfig['panelPosition'] })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="bottom">Bottom Edge</option>
                  <option value="top">Top Edge</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-kbd-layout" className="block text-xs font-medium text-slate-700 mb-1">
                  Keyboard Languages
                </label>
                <select
                  id="cfg-kbd-layout"
                  value={config.keyboardLayout}
                  onChange={(e) => onChange({ ...config, keyboardLayout: e.target.value as OsBuildConfig['keyboardLayout'] })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="us-ara">English (Primary) + Arabic (Secondary)</option>
                  <option value="us">English (us) Only</option>
                  <option value="ara-us">Arabic (Primary) + English (Secondary)</option>
                </select>
              </div>

              <div>
                <label htmlFor="cfg-kbd-toggle" className="block text-xs font-medium text-slate-700 mb-1">
                  Layout Switch Shortcut
                </label>
                <select
                  id="cfg-kbd-toggle"
                  value={config.keyboardToggle}
                  onChange={(e) => onChange({ ...config, keyboardToggle: e.target.value as OsBuildConfig['keyboardToggle'] })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="grp:alt_shift_toggle">Alt + Shift (Default)</option>
                  <option value="grp:ctrl_shift_toggle">Ctrl + Shift</option>
                  <option value="grp:win_space_toggle">Super + Space</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="cfg-browser" className="block text-xs font-medium text-slate-700 mb-1">
                  Web Browser
                </label>
                <select
                  id="cfg-browser"
                  value={config.browser}
                  onChange={(e) => onChange({ ...config, browser: e.target.value as OsBuildConfig['browser'] })}
                  className="w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="falkon">Falkon</option>
                  <option value="firefox-esr">Firefox ESR</option>
                  <option value="midori">Midori</option>
                </select>
              </div>

              <div>
                <label htmlFor="cfg-fm" className="block text-xs font-medium text-slate-700 mb-1">
                  File Manager
                </label>
                <select
                  id="cfg-fm"
                  value={config.fileManager}
                  onChange={(e) => onChange({ ...config, fileManager: e.target.value as OsBuildConfig['fileManager'] })}
                  className="w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="dolphin">Dolphin (KDE)</option>
                  <option value="pcmanfm">PCManFM</option>
                  <option value="thunar">Thunar</option>
                </select>
              </div>

              <div>
                <label htmlFor="cfg-term" className="block text-xs font-medium text-slate-700 mb-1">
                  Terminal
                </label>
                <select
                  id="cfg-term"
                  value={config.terminal}
                  onChange={(e) => onChange({ ...config, terminal: e.target.value as OsBuildConfig['terminal'] })}
                  className="w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="konsole">Konsole (KDE)</option>
                  <option value="lxterminal">LXTerminal</option>
                  <option value="alacritty">Alacritty</option>
                </select>
              </div>
            </div>
          </div>

          {/* Compatibility & Networking */}
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">03. Kernel Integration, Wine 10+ &amp; Android</h2>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.kernelIntegration}
                  onChange={(e) => onChange({ ...config, kernelIntegration: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="text-sm text-slate-800">
                  <span className="font-medium block">Kernel-Integrated BinderFS, NTSYNC &amp; binfmt_misc</span>
                  <span className="text-xs text-slate-500">Generates corepure64-android-wine.config (=y) + auto-registers ./app.exe &amp; ./app.apk in kernel binfmt_misc</span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.embedCompatInCore}
                  onChange={(e) => onChange({ ...config, embedCompatInCore: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="text-sm text-slate-800">
                  <span className="font-medium block">Embed Compat Runners &amp; Preload in Core Initrd</span>
                  <span className="text-xs text-slate-500">Injects runners directly into corepure64.gz/core.gz &amp; boots Wine 10+/Waydroid in onboot.lst</span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeWine}
                  onChange={(e) => onChange({ ...config, includeWine: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="text-sm text-slate-800">
                  <span className="font-medium block">Bundle Wine 10+ &amp; Winetricks (.exe / .msi)</span>
                  <span className="text-xs text-slate-500">WoW64 Windows 32/64-bit execution with silent prefix &amp; double-click MIME handler</span>
                </span>
              </label>

              {config.includeWine && (
                <div className="pl-7 space-y-3">
                  <div>
                    <label htmlFor="cfg-wine-ver" className="block text-xs font-medium text-slate-700 mb-1">
                      Wine Build Branch
                    </label>
                    <select
                      id="cfg-wine-ver"
                      value={config.wineVersion}
                      onChange={(e) => onChange({ ...config, wineVersion: e.target.value as OsBuildConfig['wineVersion'] })}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                    >
                      <option value="wine-10-wow64">Wine 10.x Stable WoW64 (WineHQ)</option>
                      <option value="wine-10-staging">Wine 10.x Staging + NTSYNC</option>
                    </select>
                  </div>

                  {!config.embedCompatInCore && (
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.wineOnDemand}
                        onChange={(e) => onChange({ ...config, wineOnDemand: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                      />
                      <span className="text-sm text-slate-800">
                        <span className="font-medium block">Load Wine On-Demand (cde/ondemand)</span>
                        <span className="text-xs text-slate-500">Defers Wine SquashFS loop-mount until first .exe execution</span>
                      </span>
                    </label>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="cfg-android" className="block text-xs font-medium text-slate-700 mb-1">
                  Android (.apk) Runtime Architecture
                </label>
                <select
                  id="cfg-android"
                  value={config.androidRuntime}
                  onChange={(e) => onChange({ ...config, androidRuntime: e.target.value as OsBuildConfig['androidRuntime'] })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="waydroid-cage">Waydroid + Cage (Nested Wayland in X11)</option>
                  <option value="qemu-android-microvm">QEMU-KVM Android Micro-VM + ADB</option>
                </select>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeWifiFirmware}
                  onChange={(e) => onChange({ ...config, includeWifiFirmware: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="text-sm text-slate-800">
                  <span className="font-medium block">Include Wi-Fi &amp; Hardware Firmware</span>
                  <span className="text-xs text-slate-500">wifi.tcz, nm-applet, iwlwifi, atheros, and rtlwifi blobs</span>
                </span>
              </label>
            </div>
          </div>

          {/* Live Footprint Bar */}
          <div className="p-5 bg-slate-50 rounded-b-lg flex items-center justify-between text-xs">
            <span className="text-slate-600">
              Projected ISO: <strong className="font-mono text-slate-900 tabular-nums">{estimate.totalIsoMb} MB</strong>
            </span>
            <span className="text-slate-600">
              Idle RAM: <strong className="font-mono text-slate-900 tabular-nums">~{estimate.idleRamMb} MB</strong>
            </span>
          </div>
        </div>

        {/* Right: Live xorriso & build_iso.sh Output */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-slate-950 text-slate-100 rounded-lg border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-white">
                  Hybrid BIOS + UEFI xorriso Invocation
                </h3>
                <p className="text-xs text-slate-400">
                  El Torito ISOLINUX BIOS + GPT EFI System Partition (-eltorito-alt-boot)
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(xorissoCommand, 'cmd')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedCmd ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    Copy Command
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-xs leading-relaxed font-mono overflow-x-auto text-sky-200">
              <code>{xorissoCommand}</code>
            </pre>
          </div>

          <div className="bg-slate-950 text-slate-100 rounded-lg border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-white font-mono">build_iso.sh</h3>
                <p className="text-xs text-slate-400">
                  Live generated script reflecting your active profile ({buildScriptContent.split('\n').length} lines)
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(buildScriptContent, 'script')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedScript ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    Copy build_iso.sh
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-xs leading-relaxed font-mono overflow-x-auto max-h-[460px] overflow-y-auto text-slate-200">
              <code>{buildScriptContent}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
