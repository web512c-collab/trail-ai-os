import { useMemo, useState } from 'react';
import {
  BookOpen,
  Cpu,
  Download,
  FileCode2,
  Layers,
  Menu,
  Monitor,
  Sliders,
  X,
} from 'lucide-react';
import { DEFAULT_OS_CONFIG, OsBuildConfig } from './os/types';
import {
  buildXorissoCommand,
  calculateResourceEstimate,
  generateAllArtifacts,
  getPackageManifest,
  validateBuildConfig,
} from './os/generator';
import { createZipArchive } from './os/zipBuilder';
import { OverviewView } from './components/OverviewView';
import { ConfiguratorView } from './components/ConfiguratorView';
import { DesktopPreviewView } from './components/DesktopPreviewView';
import { CompatLayersView } from './components/CompatLayersView';
import { ArtifactsView } from './components/ArtifactsView';
import { GuideView } from './components/GuideView';

type ActiveTab =
  | 'overview'
  | 'configurator'
  | 'desktop'
  | 'compat'
  | 'artifacts'
  | 'guide';

const NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  icon: typeof Cpu;
}> = [
  { id: 'overview', label: 'Overview & Architecture', icon: Layers },
  { id: 'configurator', label: 'ISO Configurator', icon: Sliders },
  { id: 'desktop', label: 'Desktop UI Preview', icon: Monitor },
  { id: 'compat', label: 'Wine & Android Layers', icon: Cpu },
  { id: 'artifacts', label: 'Build Files & Scripts', icon: FileCode2 },
  { id: 'guide', label: 'Build & Test Guide', icon: BookOpen },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [config, setConfig] = useState<OsBuildConfig>(DEFAULT_OS_CONFIG);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);

  const issues = useMemo(() => validateBuildConfig(config), [config]);
  const manifest = useMemo(() => getPackageManifest(config), [config]);
  const estimate = useMemo(() => calculateResourceEstimate(config), [config]);
  const xorissoCommand = useMemo(() => buildXorissoCommand(config), [config]);
  const artifacts = useMemo(() => generateAllArtifacts(config), [config]);

  const buildScriptContent = useMemo(
    () => artifacts.find((a) => a.path === 'build_iso.sh')?.content ?? '',
    [artifacts]
  );
  const setupScriptContent = useMemo(
    () => artifacts.find((a) => a.path === 'setup_compat_layers.sh')?.content ?? '',
    [artifacts]
  );
  const uiArtifacts = useMemo(
    () => artifacts.filter((a) => a.path.startsWith('ui_configs/')),
    [artifacts]
  );

  const activeNavLabel =
    NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? 'Overview & Architecture';

  const handleDownloadZip = () => {
    const zipBytes = createZipArchive(
      artifacts.map((a) => ({
        path: `corepure64-build/${a.path}`,
        content: a.content,
        executable: a.path.endsWith('.sh') || a.path.endsWith('autostart'),
      }))
    );

    const blob = new Blob([zipBytes as BlobPart], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `corepure64-${config.tcVersion}-build-env.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setDownloadFeedback(`Downloaded corepure64-${config.tcVersion}-build-env.zip (${artifacts.length} files)`);
    setTimeout(() => setDownloadFeedback(null), 3500);
  };

  const selectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center border-b border-slate-200">
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            CorePure64 Studio
          </span>
        </div>

        <nav aria-label="Primary workspace navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors text-left whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-sky-50 text-sky-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-sky-600' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <div className="font-medium text-slate-700">Target Profile</div>
          <div className="font-mono text-[11px] truncate">
            {config.targetArch === 'dual-x86-x86_64'
              ? 'x86+x86_64'
              : config.targetArch}{' '}
            · TC {config.tcVersion} · {config.isoName}
          </div>
          <div className="font-mono text-[11px] text-slate-600 tabular-nums">
            {estimate.totalIsoMb} MB ISO · ~{estimate.idleRamMb} MB Idle RAM
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[80vw] bg-white h-full border-r border-slate-200 flex flex-col z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold tracking-tight text-slate-900">
                CorePure64 Studio
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile workspace navigation" className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors text-left cursor-pointer ${
                      active
                        ? 'bg-sky-50 text-sky-900'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${active ? 'text-sky-600' : 'text-slate-400'}`}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action on right */}
        <header className="h-16 px-4 sm:px-8 bg-white border-b border-slate-200 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md cursor-pointer"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-500 whitespace-nowrap">
                CorePure64 Builder
              </span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900 truncate">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {downloadFeedback && (
              <span className="hidden md:inline text-xs font-medium text-emerald-700">
                {downloadFeedback}
              </span>
            )}
            <button
              type="button"
              onClick={handleDownloadZip}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span className="sm:hidden">Download .zip</span>
              <span className="hidden sm:inline">Download Build Bundle (.zip)</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              config={config}
              estimate={estimate}
              manifest={manifest}
              onNavigate={(tab) => selectTab(tab)}
            />
          )}

          {activeTab === 'configurator' && (
            <ConfiguratorView
              config={config}
              onChange={setConfig}
              estimate={estimate}
              issues={issues}
              xorissoCommand={xorissoCommand}
              buildScriptContent={buildScriptContent}
            />
          )}

          {activeTab === 'desktop' && (
            <DesktopPreviewView
              config={config}
              onChange={setConfig}
              uiArtifacts={uiArtifacts}
            />
          )}

          {activeTab === 'compat' && (
            <CompatLayersView
              config={config}
              estimate={estimate}
              setupScriptContent={setupScriptContent}
            />
          )}

          {activeTab === 'artifacts' && (
            <ArtifactsView artifacts={artifacts} />
          )}

          {activeTab === 'guide' && <GuideView config={config} />}
        </main>
      </div>
    </div>
  );
}
