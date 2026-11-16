import { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2, Search } from 'lucide-react';
import { GeneratedArtifact } from '../os/types';

interface ArtifactsViewProps {
  artifacts: GeneratedArtifact[];
}

type CategoryFilter = 'all' | GeneratedArtifact['category'];

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'All Files',
  scripts: 'Shell Scripts',
  kernel: 'Kernel Config',
  ui_configs: 'UI Configs',
  desktop: 'Desktop & MIME',
  docs: 'Documentation',
};

export function ArtifactsView({ artifacts }: ArtifactsViewProps) {
  const [selectedPath, setSelectedPath] = useState(artifacts[0]?.path ?? 'build_iso.sh');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const filteredArtifacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return artifacts.filter((a) => {
      const matchCat = category === 'all' || a.category === category;
      const matchQuery =
        q.length === 0 ||
        a.path.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [artifacts, category, query]);

  const activeArtifact =
    artifacts.find((a) => a.path === selectedPath) ?? filteredArtifacts[0] ?? artifacts[0];

  const handleCopyFile = async (artifact: GeneratedArtifact) => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopiedPath(artifact.path);
      setTimeout(() => setCopiedPath(null), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const handleDownloadSingle = (artifact: GeneratedArtifact) => {
    const blob = new Blob([artifact.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = artifact.path.split('/').pop() || 'file.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const lines = activeArtifact ? activeArtifact.content.split('\n') : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Deliverable Build Scripts &amp; Configuration Files
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          All {artifacts.length} generated files are written to the repository workspace and packaged in the top-bar ZIP bundle.
        </p>
      </div>

      {/* Category & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md overflow-x-auto">
          {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                category === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {CATEGORY_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <label htmlFor="artifact-search" className="sr-only">Filter deliverable files</label>
          <input
            id="artifact-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter file path..."
            className="w-full sm:w-64 pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
        </div>
      </div>

      {/* Split Explorer + Code Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* File Tree List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
          {filteredArtifacts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No files match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filteredArtifacts.map((artifact) => {
              const active = artifact.path === activeArtifact?.path;
              return (
                <button
                  key={artifact.path}
                  type="button"
                  onClick={() => setSelectedPath(artifact.path)}
                  className={`w-full px-4 py-3 text-left transition-colors flex items-start gap-2.5 cursor-pointer ${
                    active
                      ? 'bg-sky-100/80 text-sky-950'
                      : 'bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <FileCode2
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      active ? 'text-sky-600' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-medium truncate">
                      {artifact.path}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                      {artifact.summary}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Code Viewer */}
        {activeArtifact && (
          <div className="lg:col-span-8 bg-slate-950 text-slate-100 rounded-lg border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm font-medium text-white truncate">
                  {activeArtifact.path}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {lines.length} lines · {activeArtifact.language}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadSingle(activeArtifact)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Save File
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyFile(activeArtifact)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedPath === activeArtifact.path ? (
                    <>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto p-4 font-mono text-xs leading-relaxed">
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/70">
                      <td className="pr-4 text-right select-none text-slate-600 tabular-nums w-10 align-top">
                        {idx + 1}
                      </td>
                      <td className="whitespace-pre text-slate-200">{line || ' '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
