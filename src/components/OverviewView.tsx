import { useMemo, useState } from 'react';
import { HardDrive, Layers, MemoryStick, Search, ShieldCheck } from 'lucide-react';
import { OsBuildConfig, ResourceEstimate, TczPackageSpec } from '../os/types';

interface OverviewViewProps {
  config: OsBuildConfig;
  estimate: ResourceEstimate;
  manifest: TczPackageSpec[];
  onNavigate: (tab: 'configurator' | 'artifacts' | 'guide') => void;
}

type LayerFilter = 'all' | TczPackageSpec['layer'];

const LAYER_LABELS: Record<LayerFilter, string> = {
  all: 'All Layers',
  'kernel-core': 'Kernel & Dual-Arch',
  graphics: 'Xorg & GPU',
  'base-ui': 'Desktop & UI',
  utilities: 'Utilities',
  network: 'Wi-Fi & Firmware',
  'compat-wine': 'Wine 10+ (.exe)',
  'compat-android': 'Android (.apk)',
};

export function OverviewView({ config, estimate, manifest, onNavigate }: OverviewViewProps) {
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return manifest.filter((pkg) => {
      const matchesLayer = layerFilter === 'all' || pkg.layer === layerFilter;
      const matchesQuery =
        q.length === 0 ||
        pkg.name.toLowerCase().includes(q) ||
        pkg.purpose.toLowerCase().includes(q);
      return matchesLayer && matchesQuery;
    });
  }, [manifest, layerFilter, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Header summary */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            CorePure64 {config.tcVersion} Hybrid OS Architecture
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            {config.targetArch === 'dual-x86-x86_64'
              ? 'Dual x86 + x86_64 loop-mounted SquashFS architecture'
              : config.targetArch === 'x86_64'
              ? 'x86_64 loop-mounted SquashFS architecture'
              : '32-bit x86 loop-mounted SquashFS architecture'}{' '}
            combining {config.desktopEnvironment === 'openbox-tint2' ? 'an Openbox + Tint2 desktop' : 'KDE Plasma Lite + Openbox fallback'},{' '}
            {config.includeWine ? 'Wine 10+ WoW64 (/dev/ntsync), ' : ''}and kernel-integrated <span className="font-mono">binderfs</span> + <span className="font-mono">binfmt_misc</span> direct <span className="font-mono">.exe</span>/<span className="font-mono">.apk</span> execution.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('configurator')}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Customize Build
          </button>
          <button
            type="button"
            onClick={() => onNavigate('guide')}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Build &amp; Test Commands
          </button>
        </div>
      </div>

      {/* 4-column metric strip with hairline dividers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <HardDrive className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Estimated ISO Size</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {estimate.totalIsoMb} MB
          </div>
          <p className="mt-1 text-xs text-slate-500">
            BIOS + UEFI GPT hybrid image
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <MemoryStick className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Idle Desktop RAM</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            ~{estimate.idleRamMb} MB
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Zero copy2fs bloat · page-cached SquashFS
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Layers className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Bundled Extensions</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {estimate.extensionCount} pkgs
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {config.includeWine ? 'Wine + ' : ''}
            {config.androidRuntime === 'waydroid-cage' ? 'Waydroid/Cage' : 'QEMU Micro-VM'}
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <ShieldCheck className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Boot &amp; Persistence</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            ISOLINUX + GRUB2
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Live cde / Label {config.persistenceLabel}
          </p>
        </div>
      </div>

      {/* Layered Boot & Memory Architecture Breakdown */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              ISO Filesystem &amp; SquashFS Coexistence Model
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Heavy runtimes reside in cde/optional/ and mount read-only via /tmp/tcloop without duplicating into tmpfs RAM.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('artifacts')}
            className="text-xs font-medium text-sky-700 hover:text-sky-800 hover:underline whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
          >
            Inspect architecture_overview.md
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          <div className="p-5">
            <div className="text-xs font-medium text-slate-500">01. Hybrid Dual-Arch Boot</div>
            <div className="mt-1.5 text-sm font-semibold text-slate-900">ISOLINUX + GRUB2 EFI</div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Legacy BIOS boots <span className="font-mono">isolinux.bin</span>{config.targetArch === 'dual-x86-x86_64' ? ' (ifcpu64.c32 auto-detect)' : ''}; UEFI boots <span className="font-mono">BOOTX64.EFI</span>{config.targetArch !== 'x86_64' ? ' & BOOTIA32.EFI' : ''}.
            </p>
          </div>

          <div className="p-5">
            <div className="text-xs font-medium text-slate-500">02. Kernel &amp; Core Initrd</div>
            <div className="mt-1.5 text-sm font-semibold text-slate-900 font-mono tabular-nums">
              {estimate.baseInitrdMb} MB Initrd
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Remastered <span className="font-mono">corepure64.gz</span>{config.targetArch !== 'x86_64' ? ' + core.gz' : ''} mounts <span className="font-mono">/dev/binderfs</span>, configures <span className="font-mono">/dev/ntsync</span>, and registers <span className="font-mono">binfmt_misc</span>.
            </p>
          </div>

          <div className="p-5">
            <div className="text-xs font-medium text-slate-500">03. Desktop &amp; Drivers</div>
            <div className="mt-1.5 text-sm font-semibold text-slate-900 font-mono tabular-nums">
              {estimate.xorgUiMb + estimate.utilitiesMb} MB Loop-Mounted
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Xorg + Intel/AMD/VMware drivers, {config.desktopEnvironment === 'openbox-tint2' ? 'Openbox + Tint2' : 'Plasma Lite + Openbox'}, {config.keyboardLayout !== 'us' ? 'EN+Arabic (ara) keyboard, ' : ''}{config.fileManager}, and {config.browser} via <span className="font-mono">cde/onboot.lst</span>.
            </p>
          </div>

          <div className="p-5">
            <div className="text-xs font-medium text-slate-500">04. Wine 10+ &amp; Android</div>
            <div className="mt-1.5 text-sm font-semibold text-slate-900 font-mono tabular-nums">
              {estimate.wineSquashfsMb + estimate.androidImageMb} MB {config.embedCompatInCore ? 'Core-Ready' : 'On-Demand'}
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              {config.includeWine ? 'Wine 10.x WoW64 + ' : ''}Android SquashFS executes <span className="font-mono">.exe</span> &amp; <span className="font-mono">.apk</span> directly via kernel <span className="font-mono">binfmt_misc</span> or double-click.
            </p>
          </div>
        </div>
      </section>

      {/* Extension Manifest Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Extension &amp; SquashFS Package Manifest
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Resolved recursively with .tcz.dep dependency graphs and .md5.txt integrity checks in build_iso.sh.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <label htmlFor="pkg-search" className="sr-only">Filter extensions</label>
              <input
                id="pkg-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search .tcz package..."
                className="w-full sm:w-56 pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Layer filter segmented bar */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
          {(Object.keys(LAYER_LABELS) as LayerFilter[]).map((key) => {
            const active = layerFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setLayerFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {LAYER_LABELS[key]}
              </button>
            );
          })}
        </div>

        {filteredPackages.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-900">No matching extensions</p>
            <p className="text-xs text-slate-500 mt-1">
              Clear your search filter or switch package layers to view bundled extensions.
            </p>
            <button
              type="button"
              onClick={() => {
                setLayerFilter('all');
                setSearchQuery('');
              }}
              className="mt-4 px-3 py-1.5 text-xs font-medium text-sky-700 border border-sky-200 bg-sky-50 rounded-md hover:bg-sky-100 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/50">
                  <th className="py-2.5 px-5">Extension</th>
                  <th className="py-2.5 px-4">Subsystem Layer</th>
                  <th className="py-2.5 px-4">Load Strategy</th>
                  <th className="py-2.5 px-4">Purpose</th>
                  <th className="py-2.5 px-5 text-right">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredPackages.map((pkg) => (
                  <tr key={pkg.name} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-5 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                      {pkg.name}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {LAYER_LABELS[pkg.layer]}
                    </td>
                    <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                      <span
                        className={
                          pkg.loadMode === 'kernel-builtin'
                            ? 'text-indigo-700 font-medium'
                            : pkg.loadMode === 'initrd-core'
                            ? 'text-teal-700 font-medium'
                            : pkg.loadMode === 'onboot'
                            ? 'text-emerald-700 font-medium'
                            : pkg.loadMode === 'ondemand'
                            ? 'text-amber-700 font-medium'
                            : 'text-sky-700 font-medium'
                        }
                      >
                        {pkg.loadMode === 'kernel-builtin'
                          ? 'Kernel (=y)'
                          : pkg.loadMode === 'initrd-core'
                          ? 'Initrd Core'
                          : pkg.loadMode === 'onboot'
                          ? 'cde/onboot.lst'
                          : pkg.loadMode === 'ondemand'
                          ? 'cde/ondemand'
                          : 'cde/optional (SFS)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">
                      {pkg.purpose}
                    </td>
                    <td className="py-2.5 px-5 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {pkg.sizeMb} MB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
