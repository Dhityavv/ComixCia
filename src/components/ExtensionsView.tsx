'use client';

import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Download,
  Globe,
  Link2,
  Pencil,
  Plus,
  Power,
  Puzzle,
  RotateCcw,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import type { ComicType, ExtensionLang, ExtensionManifest } from '@/lib/types';
import { ScrollRevealTitle } from '@/components/ScrollRevealTitle';

interface ExtensionsViewProps {
  allExtensions: ExtensionManifest[];
  installedIds: string[];
  disabledIds: string[];
  baseUrlOverrides: Record<string, string>;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  onToggleEnabled: (id: string) => void;
  onSetBaseUrlOverride: (id: string, url: string) => void;
  onAddCustomExtensions: (exts: ExtensionManifest[]) => void;
}

export function ExtensionsView({
  allExtensions,
  installedIds,
  disabledIds,
  baseUrlOverrides,
  onInstall,
  onUninstall,
  onToggleEnabled,
  onSetBaseUrlOverride,
  onAddCustomExtensions,
}: ExtensionsViewProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoMsg, setRepoMsg] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Inline Base URL editor state
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [editingUrlValue, setEditingUrlValue] = useState('');

  // Custom Extension Form State
  const [customName, setCustomName] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customLang, setCustomLang] = useState<ExtensionLang>('id');
  const [customType, setCustomType] = useState<ComicType>('manhwa');
  const [popularUrl, setPopularUrl] = useState('/manga/?order=popular');
  const [searchUrl, setSearchUrl] = useState('/?s={query}');
  const [itemSelector, setItemSelector] = useState('.bs, .page-item-manga');
  const [titleSelector, setTitleSelector] = useState('.tt, h3');
  const urlSelector = 'a';
  const coverSelector = 'img';
  const [chapterListSelector, setChapterListSelector] = useState('#chapterlist li');
  const [pageImageSelector, setPageImageSelector] = useState('#readerarea img');

  const installedList = allExtensions.filter((e) => installedIds.includes(e.id));
  const catalogList = allExtensions.filter((e) => !installedIds.includes(e.id));

  const handleImportRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    setRepoLoading(true);
    setRepoMsg(null);
    try {
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });
      const json = (await res.json()) as { extensions?: ExtensionManifest[]; error?: string };
      if (!res.ok || !json.extensions?.length) {
        setRepoMsg(json.error || 'Tidak ada extension valid di repo JSON tersebut.');
      } else {
        onAddCustomExtensions(json.extensions);
        setRepoMsg(`Berhasil mengimpor ${json.extensions.length} extension!`);
        setRepoUrl('');
      }
    } catch {
      setRepoMsg('Gagal menghubungi server saat mengimpor repo.');
    } finally {
      setRepoLoading(false);
    }
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customBaseUrl.trim()) return;
    const id = `custom-${customName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    const manifest: ExtensionManifest = {
      id,
      name: customName.trim(),
      baseUrl: customBaseUrl.trim().replace(/\/$/, ''),
      lang: customLang,
      version: '1.0.0',
      description: `Custom Direct CSS extension untuk ${customBaseUrl.trim()}`,
      types: [customType],
      isPreinstalled: false,
      isCustom: true,
      scraperEngine: 'custom-css',
      accentColor: '#6366F1',
      customConfig: {
        popularUrl,
        searchUrl,
        itemSelector,
        titleSelector,
        urlSelector,
        coverSelector,
        chapterListSelector,
        pageImageSelector,
        typeDefault: customType,
      },
    };
    onAddCustomExtensions([manifest]);
    setShowCustomModal(false);
    setCustomName('');
    setCustomBaseUrl('');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#303039] bg-[#19191f] p-5">
        <div>
          <div className="font-heading text-xl font-bold text-[#f5f4f2] flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-[var(--accent)] shrink-0" aria-hidden="true" />
            <ScrollRevealTitle text="Extensions Manager" as="h1" className="inline-block" />
          </div>
          <p className="text-xs sm:text-sm text-[#a3a3aa] mt-1">
            Kelola sumber komik Bahasa Indonesia, ubah Base URL jika domain berpindah, atau tambah custom source.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border border-[#303039] bg-[#22222a] text-[#55b68b]">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            Tanpa API Key
          </span>

          <button
            type="button"
            onClick={() => setShowCustomModal(true)}
            className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 text-xs font-semibold text-[#111114] transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Buat Custom Extension
          </button>
        </div>
      </div>

      {/* Import Repo URL */}
      <form
        onSubmit={handleImportRepo}
        className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-2"
      >
        <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-indigo-400" />
          Tambah Extension Repo URL (JSON)
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://example.com/comixcia-extensions.json"
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs sm:text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={repoLoading}
            className="rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition"
          >
            {repoLoading ? 'Mengimpor...' : 'Import Repo'}
          </button>
        </div>
        {repoMsg && <p className="text-xs text-indigo-300">{repoMsg}</p>}
      </form>

      {/* Installed Extensions */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
          Terpasang ({installedList.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {installedList.map((ext) => {
            const enabled = !disabledIds.includes(ext.id);
            const effectiveUrl = baseUrlOverrides[ext.id] || ext.baseUrl;
            const isOverridden = Boolean(baseUrlOverrides[ext.id]);
            const isEditing = editingUrlId === ext.id;

            return (
              <div
                key={ext.id}
                className={`flex flex-col gap-3 rounded-xl border p-4 transition ${
                  enabled
                    ? 'border-zinc-800 bg-zinc-900/70'
                    : 'border-zinc-800/50 bg-zinc-950/60 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow"
                      style={{ backgroundColor: ext.accentColor || '#6366F1' }}
                    >
                      {ext.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-white">{ext.name}</h3>
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-300">
                          {ext.lang}
                        </span>
                        <span className="text-[10px] text-zinc-500">v{ext.version}</span>
                      </div>
                      <p className="truncate text-xs text-zinc-400">{ext.description}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1 truncate">
                        <Globe className="h-3 w-3 shrink-0" />
                        <span className={isOverridden ? 'text-indigo-300' : ''}>
                          {effectiveUrl}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {ext.scraperEngine !== 'rest-api' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditing) {
                            setEditingUrlId(null);
                          } else {
                            setEditingUrlId(ext.id);
                            setEditingUrlValue(effectiveUrl);
                          }
                        }}
                        title="Edit Base URL"
                        className="rounded-lg p-2 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white transition"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleEnabled(ext.id)}
                      title={enabled ? 'Nonaktifkan sementara' : 'Aktifkan'}
                      className={`rounded-lg p-2 border transition ${
                        enabled
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                          : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onUninstall(ext.id)}
                      title="Uninstall extension"
                      className="rounded-lg p-2 border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
                    <input
                      type="url"
                      value={editingUrlValue}
                      onChange={(e) => setEditingUrlValue(e.target.value)}
                      placeholder={ext.baseUrl}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onSetBaseUrlOverride(ext.id, editingUrlValue);
                        setEditingUrlId(null);
                      }}
                      className="rounded-lg bg-indigo-600 hover:bg-indigo-500 p-1.5 text-white"
                      title="Simpan URL"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    {isOverridden && (
                      <button
                        type="button"
                        onClick={() => {
                          onSetBaseUrlOverride(ext.id, '');
                          setEditingUrlId(null);
                        }}
                        className="rounded-lg border border-zinc-700 bg-zinc-900 p-1.5 text-zinc-300 hover:text-white"
                        title="Reset ke default"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Available Catalog */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
          Catalog Tersedia ({catalogList.length})
        </h2>
        {catalogList.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Semua extension bawaan di catalog sudah terpasang!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {catalogList.map((ext) => (
              <div
                key={ext.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: ext.accentColor || '#3B82F6' }}
                  >
                    {ext.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-white">{ext.name}</h3>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-300">
                        {ext.lang}
                      </span>
                    </div>
                    <p className="truncate text-xs text-zinc-400">{ext.description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onInstall(ext.id)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#e5484d] hover:bg-[#f05a5f] px-3 py-2 text-xs font-semibold text-white transition-colors"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Install
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Custom Extension Modal */}
      {showCustomModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowCustomModal(false)}
        >
          <form
            onSubmit={handleCreateCustom}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Buat Custom Extension (Direct CSS)</h3>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400">Nama Sumber</label>
                <input
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Misal: KomikCast"
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Base URL</label>
                <input
                  required
                  type="url"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="https://komikcast.bz"
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Bahasa</label>
                <select
                  value={customLang}
                  onChange={(e) => setCustomLang(e.target.value as ExtensionLang)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                >
                  <option value="id">Indonesia (ID)</option>
                  <option value="en">English (EN)</option>
                  <option value="multi">Multi</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400">Tipe Utama</label>
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value as ComicType)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                >
                  <option value="manhwa">Manhwa</option>
                  <option value="manga">Manga</option>
                  <option value="manhua">Manhua</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400">Popular Path</label>
                <input
                  value={popularUrl}
                  onChange={(e) => setPopularUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Search Path ({'{query}'})</label>
                <input
                  value={searchUrl}
                  onChange={(e) => setSearchUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Item Selector</label>
                <input
                  value={itemSelector}
                  onChange={(e) => setItemSelector(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Title Selector</label>
                <input
                  value={titleSelector}
                  onChange={(e) => setTitleSelector(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Chapter List Selector</label>
                <input
                  value={chapterListSelector}
                  onChange={(e) => setChapterListSelector(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Page Image Selector</label>
                <input
                  value={pageImageSelector}
                  onChange={(e) => setPageImageSelector(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-xs text-zinc-300"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white"
              >
                Simpan & Install
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
