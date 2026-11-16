import { useEffect, useState } from 'react';
import {
  AppWindow,
  FolderOpen,
  Globe,
  Monitor,
  Smartphone,
  Terminal,
  Volume2,
  Wifi,
} from 'lucide-react';
import { GeneratedArtifact, OsBuildConfig } from '../os/types';

interface DesktopPreviewViewProps {
  config: OsBuildConfig;
  onChange: (next: OsBuildConfig) => void;
  uiArtifacts: GeneratedArtifact[];
}

export function DesktopPreviewView({
  config,
  onChange,
  uiArtifacts,
}: DesktopPreviewViewProps) {
  const [rofiOpen, setRofiOpen] = useState(false);
  const [activeAppWindow, setActiveAppWindow] = useState<'files' | 'wine' | 'android'>('files');
  const [selectedConfigPath, setSelectedConfigPath] = useState(
    uiArtifacts[0]?.path ?? 'ui_configs/openbox/rc.xml'
  );
  const [wallpaperFailed, setWallpaperFailed] = useState(false);
  const [activeKbdLang, setActiveKbdLang] = useState<'EN' | 'AR'>(
    config.keyboardLayout === 'ara-us' ? 'AR' : 'EN'
  );

  useEffect(() => {
    setActiveKbdLang(config.keyboardLayout === 'ara-us' ? 'AR' : 'EN');
  }, [config.keyboardLayout]);

  const isDark = config.desktopTheme === 'slate-dark';
  const isTop = config.panelPosition === 'top';
  const isPlasma = config.desktopEnvironment !== 'openbox-tint2';
  const fmLabel =
    config.fileManager === 'dolphin'
      ? 'Dolphin'
      : config.fileManager === 'pcmanfm'
      ? 'PCManFM'
      : 'Thunar';
  const activeArtifact =
    uiArtifacts.find((a) => a.path === selectedConfigPath) ?? uiArtifacts[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Desktop Environment Preview &amp; UI Configs
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Interactive {isPlasma ? 'KDE Plasma Lite (KWin + Breeze)' : 'Openbox + Tint2 + Rofi'} session preview synchronized with <span className="font-mono">ui_configs/</span>.
          </p>
        </div>

        {/* Live session, theme & edge controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-md">
            <button
              type="button"
              onClick={() => onChange({ ...config, desktopEnvironment: 'dual-plasma-openbox' })}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isPlasma ? 'bg-slate-900 text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              KDE Plasma Lite
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...config, desktopEnvironment: 'openbox-tint2' })}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !isPlasma ? 'bg-slate-900 text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Openbox Fallback
            </button>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-md">
            <button
              type="button"
              onClick={() => onChange({ ...config, desktopTheme: 'slate-dark' })}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isDark ? 'bg-slate-900 text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Slate Dark
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...config, desktopTheme: 'paper-light' })}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !isDark ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Paper Light
            </button>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-md">
            <button
              type="button"
              onClick={() => onChange({ ...config, panelPosition: 'bottom' })}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !isTop ? 'bg-slate-900 text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Bottom Panel
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...config, panelPosition: 'top' })}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isTop ? 'bg-slate-900 text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Top Panel
            </button>
          </div>
        </div>
      </div>

      {/* Simulated Desktop Viewport */}
      <div className="bg-slate-950 rounded-lg border border-slate-300 overflow-hidden shadow-xs">
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span className="font-mono">
              {isPlasma
                ? `Xorg 7.7 · KWin + Plasma Lite · ${config.hostname}`
                : `Xorg 7.7 · Openbox 3.6 · Tint2 · ${config.hostname}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRofiOpen((v) => !v)}
              className="px-2.5 py-1 text-xs font-medium bg-sky-600 text-white rounded hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {rofiOpen
                ? isPlasma ? 'Close KRunner' : 'Close Rofi (Super+Space)'
                : isPlasma ? 'Open KRunner / App Menu' : 'Open Rofi Launcher'}
            </button>
          </div>
        </div>

        {/* Desktop Canvas */}
        <div className="relative h-[440px] w-full overflow-hidden select-none">
          {/* Wallpaper Image with Fallback */}
          {!wallpaperFailed ? (
            <img
              src="/src/assets/images/os_desktop_wallpaper_1794853680495.jpg"
              alt="CorePure64 Openbox geometric desktop wallpaper"
              referrerPolicy="no-referrer"
              onError={() => setWallpaperFailed(true)}
              className={`absolute inset-0 w-full h-full object-cover ${
                isDark ? 'brightness-90' : 'brightness-125 contrast-75 opacity-40'
              }`}
            />
          ) : (
            <div
              className={`absolute inset-0 ${
                isDark
                  ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800'
                  : 'bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300'
              }`}
            />
          )}

          {!isDark && wallpaperFailed && (
            <div className="absolute inset-0 bg-slate-100/80" />
          )}

          {/* Tint2 Panel (Top or Bottom) */}
          <div
            className={`absolute left-0 right-0 h-9 px-3 flex items-center justify-between z-20 border-slate-700/60 ${
              isTop ? 'top-0 border-b' : 'bottom-0 border-t'
            } ${
              isDark
                ? 'bg-slate-900/95 text-slate-100 border-slate-700'
                : 'bg-slate-50/95 text-slate-900 border-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => setRofiOpen((v) => !v)}
                aria-label="Launch Rofi Application Menu"
                className="px-2.5 py-1 text-xs font-semibold bg-sky-600 text-white rounded hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Apps
              </button>
              <button
                type="button"
                onClick={() => setActiveAppWindow('files')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeAppWindow === 'files'
                    ? isDark
                      ? 'bg-slate-800 text-white border-b-2 border-sky-400'
                      : 'bg-slate-200 text-slate-900 border-b-2 border-sky-600'
                    : 'opacity-80 hover:opacity-100'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                {fmLabel}
              </button>
              {config.includeWine && (
                <button
                  type="button"
                  onClick={() => setActiveAppWindow('wine')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeAppWindow === 'wine'
                      ? isDark
                        ? 'bg-slate-800 text-white border-b-2 border-sky-400'
                        : 'bg-slate-200 text-slate-900 border-b-2 border-sky-600'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <AppWindow className="w-3.5 h-3.5" aria-hidden="true" />
                  Wine (.exe)
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveAppWindow('android')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeAppWindow === 'android'
                    ? isDark
                      ? 'bg-slate-800 text-white border-b-2 border-sky-400'
                      : 'bg-slate-200 text-slate-900 border-b-2 border-sky-600'
                    : 'opacity-80 hover:opacity-100'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
                Android (.apk)
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono tabular-nums shrink-0">
              {config.keyboardLayout !== 'us' && (
                <button
                  type="button"
                  onClick={() => setActiveKbdLang((prev) => (prev === 'EN' ? 'AR' : 'EN'))}
                  title="Switch Keyboard Layout (EN / Arabic ara)"
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                    isDark ? 'bg-slate-800 text-sky-300 hover:bg-slate-700' : 'bg-slate-200 text-sky-800 hover:bg-slate-300'
                  }`}
                >
                  {activeKbdLang === 'AR' ? 'عربي' : 'EN'}
                </button>
              )}
              {config.includeWifiFirmware && (
                <Wifi className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
              )}
              <Volume2 className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
              <span>10:28</span>
            </div>
          </div>

          {/* Active Window */}
          <div
            className={`absolute left-6 right-6 sm:left-12 sm:right-auto sm:w-[540px] rounded-md border shadow-xl overflow-hidden z-10 ${
              isTop ? 'top-14' : 'top-8'
            } ${
              isDark
                ? 'bg-slate-900/95 border-slate-700 text-slate-100'
                : 'bg-white/95 border-slate-300 text-slate-900'
            }`}
          >
            {/* Window Titlebar */}
            <div
              className={`px-3 py-2 flex items-center justify-between border-b text-xs font-medium ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-100'
                  : 'bg-slate-100 border-slate-200 text-slate-900'
              }`}
            >
              <span>
                {activeAppWindow === 'files'
                  ? `${fmLabel} — /home/tc/Downloads`
                  : activeAppWindow === 'wine'
                  ? 'Wine64 Prefix — app-setup.exe'
                  : config.androidRuntime === 'waydroid-cage'
                  ? 'Cage Wayland Window — Waydroid Android Runtime'
                  : 'QEMU-KVM — Android Micro-VM'}
              </span>
              <span className="font-mono text-[11px] opacity-70">_ □ ×</span>
            </div>

            {/* Window Body */}
            <div className="p-4 text-xs space-y-3">
              {activeAppWindow === 'files' && (
                <>
                  <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                    Double-click any Windows <span className="font-mono">.exe</span> or Android <span className="font-mono">.apk</span> package to execute via registered <span className="font-mono">mimeapps.list</span> handlers:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveAppWindow('wine')}
                      className={`p-3 rounded border text-left transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-slate-800/80 border-slate-700 hover:border-sky-500'
                          : 'bg-slate-50 border-slate-200 hover:border-sky-600'
                      }`}
                    >
                      <div className="font-mono font-medium">utility-win64.exe</div>
                      <div className="mt-1 opacity-70">Opens with wine-exe-runner</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAppWindow('android')}
                      className={`p-3 rounded border text-left transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-slate-800/80 border-slate-700 hover:border-sky-500'
                          : 'bg-slate-50 border-slate-200 hover:border-sky-600'
                      }`}
                    >
                      <div className="font-mono font-medium">mobile-app.apk</div>
                      <div className="mt-1 opacity-70">Installs via android-apk-runner</div>
                    </button>
                  </div>
                </>
              )}

              {activeAppWindow === 'wine' && (
                <div className="space-y-2">
                  <div className="font-mono text-[11px] opacity-80">
                    $ WINEPREFIX=~/.wine WINEDEBUG=-all wine /home/tc/Downloads/utility-win64.exe
                  </div>
                  <div
                    className={`p-3 rounded border font-mono text-[11px] leading-relaxed ${
                      isDark ? 'bg-slate-950 border-slate-800 text-emerald-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    Wine64 WoW64 prefix initialized silently (mscoree/mshtml bypassed).
                    <br />
                    Mode: {config.wineOnDemand ? 'On-Demand SquashFS mount (cde/ondemand/wine)' : 'Loop-mounted SquashFS (/tmp/tcloop/wine)'}
                    <br />
                    Ready for direct double-click .exe &amp; .msi execution.
                  </div>
                </div>
              )}

              {activeAppWindow === 'android' && (
                <div className="space-y-2">
                  <div className="font-mono text-[11px] opacity-80">
                    $ /usr/local/bin/android-apk-runner /home/tc/Downloads/mobile-app.apk
                  </div>
                  <div
                    className={`p-3 rounded border font-mono text-[11px] leading-relaxed ${
                      isDark ? 'bg-slate-950 border-slate-800 text-sky-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    {config.androidRuntime === 'waydroid-cage'
                      ? 'Starting waydroid container + nested Cage Wayland compositor inside X11...'
                      : 'Booting QEMU-KVM Android micro-VM and pushing APK over ADB port 5555...'}
                    <br />
                    APK installed &amp; surfaced in Openbox desktop window.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rofi Launcher Modal */}
          {rofiOpen && (
            <div
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[400px] rounded-lg border p-3.5 shadow-2xl z-30 ${
                isDark
                  ? 'bg-slate-900/95 border-slate-700 text-slate-100'
                  : 'bg-white/95 border-slate-300 text-slate-900'
              }`}
            >
              <div
                className={`px-3 py-2 rounded text-xs font-mono mb-2 ${
                  isDark ? 'bg-slate-800 text-sky-300' : 'bg-slate-100 text-sky-700'
                }`}
              >
                drun: Search applications...
              </div>
              <div className="space-y-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAppWindow('files');
                    setRofiOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded bg-sky-600 text-white text-left cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{fmLabel} File Manager</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveAppWindow('wine');
                    setRofiOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left cursor-pointer ${
                    isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                  }`}
                >
                  <AppWindow className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Windows EXE Runner (Wine)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveAppWindow('android');
                    setRofiOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left cursor-pointer ${
                    isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Android Desktop ({config.androidRuntime === 'waydroid-cage' ? 'Waydroid' : 'QEMU'})</span>
                </button>
                <div className="flex items-center gap-2.5 px-3 py-2 opacity-75">
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Web Browser ({config.browser})</span>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-2 opacity-75">
                  <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Terminal ({config.terminal})</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ui_configs/ File Switcher + Inspector */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2 overflow-x-auto">
          {uiArtifacts.map((art) => {
            const shortName = art.path.replace(/^ui_configs\//, '');
            const active = art.path === activeArtifact?.path;
            return (
              <button
                key={art.path}
                type="button"
                onClick={() => setSelectedConfigPath(art.path)}
                className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                {shortName}
              </button>
            );
          })}
        </div>

        {activeArtifact && (
          <div>
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-4 text-xs text-slate-600">
              <span className="truncate">{activeArtifact.summary}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline font-mono text-slate-400">{activeArtifact.path}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(activeArtifact.content)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Copy Config
                </button>
              </div>
            </div>
            <pre className="p-4 text-xs leading-relaxed font-mono bg-slate-950 text-slate-100 overflow-x-auto max-h-96 overflow-y-auto">
              <code>{activeArtifact.content}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
