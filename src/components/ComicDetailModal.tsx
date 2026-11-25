'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  Loader2,
  Play,
  Search,
} from 'lucide-react';
import type { Category, ChapterSummary, ComicDetail, ComicSummary } from '@/lib/types';
import type { AlternativeSourceMatch } from '@/app/api/alternatives/route';
import { getProxiedImageUrl } from '@/lib/storage';
import { ScrollRevealTitle } from '@/components/ScrollRevealTitle';
import { applyAdaptiveTheme, extractThemeFromImage } from '@/lib/adaptive-theme';

interface ComicDetailModalProps {
  summary: ComicSummary;
  detail: ComicDetail | null;
  loading: boolean;
  error?: string | null;
  inLibrary: boolean;
  categories: Category[];
  currentCategoryId?: string;
  lastReadChapterId?: string;
  alternatives?: AlternativeSourceMatch[];
  alternativesLoading?: boolean;
  onSwitchSource?: (comic: ComicSummary) => void;
  onToggleLibrary: (comic: ComicSummary, categoryIds?: string[]) => void;
  onChangeLibraryCategory?: (sourceId: string, url: string, categoryId: string) => void;
  onReadChapter: (detail: ComicDetail, chapter: ChapterSummary) => void;
  onClose: () => void;
}

export function ComicDetailModal({
  summary,
  detail,
  loading,
  error,
  inLibrary,
  categories,
  currentCategoryId,
  lastReadChapterId,
  alternatives = [],
  alternativesLoading = false,
  onSwitchSource,
  onToggleLibrary,
  onChangeLibraryCategory,
  onReadChapter,
  onClose,
}: ComicDetailModalProps) {
  const [chapterQuery, setChapterQuery] = useState('');
  const [ascending, setAscending] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(currentCategoryId || 'reading');

  const active = detail || summary;
  const coverSrc = getProxiedImageUrl(detail?.coverUrl || summary.coverUrl);

  // Adaptive Artwork Theme extraction
  useEffect(() => {
    if (!coverSrc) return;
    let activeFlag = true;
    extractThemeFromImage(coverSrc).then((theme) => {
      if (activeFlag) applyAdaptiveTheme(theme);
    });
    return () => {
      activeFlag = false;
    };
  }, [coverSrc]);

  const chapters = useMemo(() => {
    const list = detail?.chapters || [];
    const filtered = chapterQuery.trim()
      ? list.filter((c) =>
          c.title.toLowerCase().includes(chapterQuery.toLowerCase())
        )
      : list;
    return ascending ? [...filtered].reverse() : filtered;
  }, [detail?.chapters, chapterQuery, ascending]);

  const continueChapter = useMemo(() => {
    if (!detail?.chapters.length) return null;
    if (lastReadChapterId) {
      const found = detail.chapters.find((c) => c.id === lastReadChapterId);
      if (found) return found;
    }
    return detail.chapters[detail.chapters.length - 1];
  }, [detail, lastReadChapterId]);

  const synopsisText = loading
    ? 'Mengambil informasi komik...'
    : detail?.synopsis || 'Tidak ada sinopsis untuk judul ini.';

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Back Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 h-10 rounded-xl border border-[#303039] bg-[#19191f] px-4 text-xs font-medium text-[#f5f4f2] hover:bg-[#22222a] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali
        </button>
        <span className="rounded-lg bg-[#19191f] border border-[#303039] px-3 py-1.5 text-xs font-medium text-[#a3a3aa]">
          {active.sourceName || active.sourceId}
        </span>
      </div>

      {/* Hero Section with Adaptive Artwork Backdrop */}
      <section className="relative overflow-hidden rounded-2xl border border-[#303039] bg-[#19191f] p-5 sm:p-8">
        {coverSrc && (
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-20 blur-2xl scale-110 pointer-events-none"
            style={{
              backgroundImage: `url(${coverSrc})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#111114] via-[#111114]/80 to-[#111114]/60 pointer-events-none"
        />

        <div className="relative z-10 flex flex-col sm:flex-row gap-6 sm:gap-8">
          <div className="w-40 sm:w-48 shrink-0 mx-auto sm:mx-0">
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[#22222a] border border-[#303039] shadow-lg">
              {coverSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverSrc}
                  alt={active.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[#a3a3aa]/40">
                  <BookOpen className="h-10 w-10" aria-hidden="true" />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {active.type !== 'unknown' && (
                <span className="rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 py-0.5 font-semibold uppercase text-[var(--accent)]">
                  {active.type}
                </span>
              )}
              {active.status && active.status !== 'unknown' && (
                <span className="rounded-md border border-[#303039] bg-[#22222a] px-2.5 py-0.5 font-semibold uppercase text-[#f5f4f2]">
                  {active.status === 'ongoing' ? 'Berlanjut' : active.status === 'completed' ? 'Tamat' : active.status}
                </span>
              )}
              {active.author && (
                <span className="text-[#a3a3aa]">Karya {active.author}</span>
              )}
            </div>

            <ScrollRevealTitle
              text={active.title}
              as="h1"
              className="font-heading text-2xl sm:text-3xl font-bold text-[#f5f4f2] leading-tight"
            />

            {detail?.genres && detail.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {detail.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-lg bg-[#22222a]/90 border border-[#303039] px-2.5 py-1 text-xs text-[#a3a3aa]"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-1.5 max-w-[70ch]">
              <p
                className={`text-sm text-[#a3a3aa] leading-relaxed ${
                  synopsisExpanded ? '' : 'line-clamp-3'
                }`}
              >
                {synopsisText}
              </p>
              {synopsisText.length > 180 && (
                <button
                  type="button"
                  onClick={() => setSynopsisExpanded((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
                >
                  {synopsisExpanded ? (
                    <>
                      Ringkas <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      Selengkapnya <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Reading Actions */}
            <div className="pt-1 flex flex-wrap items-center gap-3">
              {detail && continueChapter && (
                <button
                  type="button"
                  onClick={() => onReadChapter(detail, continueChapter)}
                  className="inline-flex items-center gap-2 h-11 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 text-sm font-semibold text-[#111114] transition-colors"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  {lastReadChapterId ? 'Lanjut Baca' : 'Mulai Baca'}
                </button>
              )}

              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleLibrary(active, ['default', selectedCategory])}
                  className={`inline-flex items-center gap-2 h-11 rounded-xl border px-4 text-sm font-medium transition-colors ${
                    inLibrary
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[#f5f4f2]'
                      : 'border-[#303039] bg-[#22222a] text-[#f5f4f2] hover:border-[#a3a3aa]'
                  }`}
                >
                  {inLibrary ? (
                    <>
                      <BookmarkCheck className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
                      Tersimpan
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-4 w-4" aria-hidden="true" />
                      Simpan
                    </>
                  )}
                </button>

                <select
                  aria-label="Status membaca di koleksi"
                  value={selectedCategory}
                  onChange={(e) => {
                    const nextCat = e.target.value;
                    setSelectedCategory(nextCat);
                    if (inLibrary && onChangeLibraryCategory) {
                      onChangeLibraryCategory(active.sourceId, active.url, nextCat);
                    }
                  }}
                  className="h-11 rounded-xl border border-[#303039] bg-[#22222a] px-3 text-xs text-[#f5f4f2]"
                >
                  {categories
                    .filter((c) => c.id !== 'default')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              {active.url.startsWith('http') && (
                <a
                  href={active.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 h-11 rounded-xl border border-[#303039] bg-[#19191f] px-4 text-xs text-[#a3a3aa] hover:text-[#f5f4f2] transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Sumber Asli
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Source Switcher */}
      <section className="rounded-2xl border border-[#303039] bg-[#19191f] p-4 space-y-3" aria-label="Pindah Sumber Komik">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#f5f4f2]">
            <Layers className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
            <span>Sumber Komik</span>
          </div>
          {alternativesLoading ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#a3a3aa]">
              <Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" aria-hidden="true" />
              Mengecek kelengkapan chapter di sumber lain...
            </span>
          ) : (() => {
            const currentCount = detail?.chapters.length ?? 0;
            const bestAlt = alternatives[0];
            if (bestAlt && bestAlt.chapterCount > currentCount && onSwitchSource) {
              return (
                <button
                  type="button"
                  onClick={() => onSwitchSource(bestAlt.comic)}
                  className="text-[11px] font-medium text-[var(--accent)] hover:underline"
                >
                  Lebih lengkap di {bestAlt.sourceName} ({bestAlt.chapterCount} Ch) — Klik untuk pindah
                </button>
              );
            }
            return null;
          })()}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 text-xs font-semibold text-[#f5f4f2]">
            <span>{active.sourceName || active.sourceId}</span>
            <span className="font-mono text-[11px] text-[var(--accent)] tabular-nums">
              ({detail?.chapters.length ?? 0} Ch)
            </span>
          </span>

          {alternatives.map((alt) => (
            <button
              key={alt.sourceId}
              type="button"
              onClick={() => onSwitchSource?.(alt.comic)}
              className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-[#303039] bg-[#111114] hover:border-[var(--accent)] px-3 text-xs font-medium text-[#f5f4f2] transition-colors"
            >
              <span>{alt.sourceName}</span>
              <span className="font-mono text-[11px] text-[#a3a3aa] tabular-nums">
                ({alt.chapterCount} Ch)
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Chapter Directory */}
      <section className="space-y-4 rounded-2xl border border-[#303039] bg-[#19191f] p-5" aria-label="Daftar Chapter">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-base font-bold text-[#f5f4f2] tabular-nums">
            Daftar Chapter ({detail?.chapters.length ?? 0})
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-[#a3a3aa] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                aria-label="Cari chapter"
                value={chapterQuery}
                onChange={(e) => setChapterQuery(e.target.value)}
                placeholder="Cari chapter..."
                className="h-10 w-44 sm:w-56 rounded-xl border border-[#303039] bg-[#111114] pl-9 pr-3 text-xs text-[#f5f4f2] placeholder:text-[#a3a3aa]/70"
              />
            </div>
            <button
              type="button"
              onClick={() => setAscending((v) => !v)}
              className="inline-flex items-center gap-1.5 h-10 rounded-xl border border-[#303039] bg-[#111114] px-3 text-xs font-medium text-[#f5f4f2] hover:bg-[#22222a] transition-colors"
            >
              <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
              {ascending ? 'Terlama' : 'Terbaru'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="status" aria-label="Memuat chapter">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div key={idx} className="h-14 rounded-xl bg-[#22222a] border border-[#303039] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-700/40 bg-rose-950/30 p-4 text-xs text-rose-200">
            {error}
          </div>
        ) : chapters.length === 0 ? (
          <div className="rounded-xl border border-[#303039] bg-[#111114] p-6 text-center text-xs text-[#a3a3aa] space-y-1">
            <p className="text-[#f5f4f2] font-medium">Belum ada chapter Bahasa Indonesia yang tersedia di sumber ini.</p>
            <p>Judul ini kemungkinan hanya tersedia lewat tautan resmi eksternal. Coba cari judul yang sama di sumber Komiku atau LINE Webtoon ID.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {chapters.map((ch) => {
              const isLastRead = ch.id === lastReadChapterId;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => detail && onReadChapter(detail, ch)}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                    isLastRead
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[#f5f4f2]'
                      : 'border-[#303039] bg-[#111114] text-[#f5f4f2] hover:border-[var(--accent)]/60 hover:bg-[#22222a]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs sm:text-sm font-medium">
                      {ch.title}
                    </p>
                    {(ch.scanlator || ch.uploadedAt) && (
                      <p className="truncate text-[11px] text-[#a3a3aa]">
                        {[ch.scanlator, ch.uploadedAt].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                  {isLastRead && (
                    <span className="shrink-0 rounded-md bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-[#111114]">
                      Terakhir
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
