'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLenis } from 'lenis/react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Eye,
  EyeOff,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCw,
  ScrollText,
  Settings2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type {
  ChapterPages,
  ChapterSummary,
  ComicDetail,
  ImageWidthOption,
  ReadingMode,
  ReadingSettings,
} from '@/lib/types';
import { getProxiedImageUrl } from '@/lib/storage';

interface ComicReaderProps {
  comic: ComicDetail;
  chapter: ChapterSummary;
  chapterData: ChapterPages | null;
  loading: boolean;
  error?: string | null;
  settings: ReadingSettings;
  onUpdateSettings: (patch: Partial<ReadingSettings>) => void;
  onSelectChapter: (chapter: ChapterSummary) => void;
  onProgress: (pageIndex: number, totalPages: number) => void;
  onClose: () => void;
}

interface ReaderPageImageProps {
  src: string;
  alt: string;
  className: string;
  eager?: boolean;
  onEnter?: () => void;
}

function ReaderPageImage({ src, alt, className, eager, onEnter }: ReaderPageImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);

  const effectiveSrc = retryCount > 0 ? `${src}&_r=${retryCount}` : src;

  if (status === 'error') {
    return (
      <div className={`${className} min-h-[260px] flex flex-col items-center justify-center gap-2.5 bg-[#19191f] border border-[#303039] rounded-xl text-[#a3a3aa] p-6`}>
        <p className="text-xs">Panel gagal dimuat ({alt})</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setStatus('loading');
            setRetryCount((c) => c + 1);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-3.5 py-2 text-xs font-semibold text-[#111114] transition-colors"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          Muat Ulang Panel
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full flex justify-center [content-visibility:auto] [contain-intrinsic-size:auto_640px]">
      {status === 'loading' && (
        <div
          className={`${className} min-h-[360px] bg-[#19191f] animate-pulse`}
          aria-hidden="true"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={effectiveSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onMouseEnter={onEnter}
        onLoad={() => setStatus('loaded')}
        onError={() => {
          if (retryCount < 2) {
            setRetryCount((c) => c + 1);
          } else {
            setStatus('error');
          }
        }}
        className={`${className} ${status === 'loading' ? 'sr-only' : ''}`}
      />
    </div>
  );
}

export function ComicReader({
  comic,
  chapter,
  chapterData,
  loading,
  error,
  settings,
  onUpdateSettings,
  onSelectChapter,
  onProgress,
  onClose,
}: ComicReaderProps) {
  const readerRef = useRef<HTMLDivElement>(null);
  const lenis = useLenis();
  const [hudVisible, setHudVisible] = useState(!settings.autoHideToolbar);
  const [focusMode, setFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const pages = useMemo(() => chapterData?.pages || [], [chapterData?.pages]);
  const totalPages = pages.length;

  const currentChapterIndex = comic.chapters.findIndex(
    (c) => c.id === chapter.id || c.url === chapter.url
  );
  const nextChapter =
    currentChapterIndex > 0 ? comic.chapters[currentChapterIndex - 1] : null;
  const prevChapter =
    currentChapterIndex >= 0 && currentChapterIndex < comic.chapters.length - 1
      ? comic.chapters[currentChapterIndex + 1]
      : null;

  // Pause background Lenis & lock scrollTop strictly to 0
  useEffect(() => {
    lenis?.stop();
    if (readerRef.current) {
      readerRef.current.scrollTop = 0;
    }
    return () => {
      lenis?.start();
    };
  }, [chapter.id, lenis]);

  useEffect(() => {
    if (!loading && readerRef.current) {
      readerRef.current.scrollTop = 0;
    }
  }, [loading, chapter.id]);

  // Selective preloader: only 5 pages ahead to save RAM on low-end devices
  useEffect(() => {
    if (!pages.length) return;
    const upcoming = pages.slice(currentPage + 1, currentPage + 6);
    upcoming.forEach((src) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = getProxiedImageUrl(src, chapterData?.referer);
    });
  }, [currentPage, pages, chapterData?.referer]);

  // Prefetch next chapter
  useEffect(() => {
    if (!nextChapter || loading) return;
    const timer = setTimeout(() => {
      fetch('/api/chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: comic.sourceId, url: nextChapter.url }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [nextChapter, loading, comic.sourceId]);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      readerRef.current?.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  const goToPage = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(totalPages - 1, idx));
      setCurrentPage(clamped);
      if (totalPages > 0) {
        onProgress(clamped, totalPages);
      }
    },
    [totalPages, onProgress]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false);
        else if (focusMode) setFocusMode(false);
        else onClose();
      } else if (e.key === 'h' || e.key === 'H') {
        setFocusMode((v) => !v);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (settings.mode !== 'webtoon') {
        const step = settings.mode === 'double' ? 2 : 1;
        if (e.key === 'ArrowRight') {
          goToPage(settings.direction === 'rtl' ? currentPage - step : currentPage + step);
        } else if (e.key === 'ArrowLeft') {
          goToPage(settings.direction === 'rtl' ? currentPage + step : currentPage - step);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen, focusMode, settings.mode, settings.direction, currentPage, goToPage, onClose, toggleFullscreen]);

  const widthClass =
    settings.imageWidth === '70'
      ? 'w-[70vw] max-w-[780px]'
      : settings.imageWidth === '85'
        ? 'w-[85vw] max-w-[960px]'
        : settings.imageWidth === '100'
          ? 'w-full max-w-none'
          : 'w-full max-w-[680px]';

  const fitClass =
    settings.fitMode === 'width'
      ? `${widthClass} mx-auto h-auto`
      : settings.fitMode === 'height'
        ? 'max-h-[86vh] w-auto max-w-[760px] mx-auto object-contain'
        : `${widthClass} mx-auto h-auto`;

  const showToolbar = !focusMode && hudVisible;

  return (
    <div
      ref={readerRef}
      data-lenis-prevent
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto select-none"
      style={{ backgroundColor: settings.backgroundColor, overflowAnchor: 'none' }}
    >
      {/* Top Minimal Header */}
      <header
        className={`fixed top-0 inset-x-0 z-30 flex items-center justify-between gap-3 px-4 py-2.5 bg-[#111114]/95 border-b border-[#303039] transition-transform duration-200 ${
          showToolbar ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Kembali ke komik"
            className="rounded-lg p-2 text-[#a3a3aa] hover:bg-[#22222a] hover:text-[#f5f4f2] transition-colors"
            title="Kembali (Esc)"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="font-heading truncate text-sm font-bold text-[#f5f4f2]">{comic.title}</p>
            <p className="truncate text-xs text-[#a3a3aa]">{chapter.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            aria-label="Pilih chapter"
            value={chapter.id}
            onChange={(e) => {
              const found = comic.chapters.find((c) => c.id === e.target.value);
              if (found) onSelectChapter(found);
            }}
            className="hidden sm:block h-9 max-w-[210px] rounded-lg bg-[#19191f] border border-[#303039] px-2.5 text-xs text-[#f5f4f2]"
          >
            {comic.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setFocusMode((v) => !v)}
            aria-label="Mode Fokus (H)"
            className="rounded-lg p-2 text-[#a3a3aa] hover:bg-[#22222a] hover:text-[#f5f4f2] transition-colors"
            title="Mode Fokus (H)"
          >
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Fullscreen (F)"
            className="hidden sm:inline-flex rounded-lg p-2 text-[#a3a3aa] hover:bg-[#22222a] hover:text-[#f5f4f2] transition-colors"
            title="Fullscreen (F)"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Pengaturan Reader"
            className={`rounded-lg p-2 transition-colors ${
              settingsOpen
                ? 'bg-[var(--accent)] text-[#111114]'
                : 'text-[#a3a3aa] hover:bg-[#22222a] hover:text-[#f5f4f2]'
            }`}
            title="Pengaturan Reader"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Reader Content */}
      <main
        className={`flex-1 flex flex-col items-center min-h-screen py-16 px-0 sm:px-4 ${
          loading || error || pages.length === 0 ? 'justify-center' : 'justify-start'
        }`}
        onClick={() => {
          if (focusMode) setFocusMode(false);
          else setHudVisible((v) => !v);
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-24 text-[#a3a3aa]" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" aria-hidden="true" />
            <p className="text-sm">Memuat halaman chapter...</p>
          </div>
        ) : error ? (
          <div className="max-w-md rounded-xl border border-rose-500/30 bg-rose-950/30 p-6 text-center">
            <p className="text-sm font-semibold text-rose-300 mb-2">Gagal Memuat Chapter</p>
            <p className="text-xs text-rose-200/80">{error}</p>
          </div>
        ) : pages.length === 0 ? (
          <div className="max-w-md rounded-xl border border-[#303039] bg-[#19191f] p-6 text-center">
            <p className="text-sm text-[#a3a3aa]">
              Tidak ada gambar yang ditemukan di chapter ini. Coba pilih chapter lain atau sumber komik lain.
            </p>
          </div>
        ) : settings.mode === 'webtoon' ? (
          <div
            className="w-full flex flex-col items-center"
            style={{ gap: `${settings.pageGap}px` }}
          >
            {pages.map((src, idx) => (
              <ReaderPageImage
                key={`${chapter.id}-${idx}`}
                src={getProxiedImageUrl(src, chapterData?.referer)}
                alt={`Halaman ${idx + 1}`}
                eager={idx < 8}
                onEnter={() => {
                  setCurrentPage(idx);
                  onProgress(idx, totalPages);
                }}
                className={fitClass}
              />
            ))}
          </div>
        ) : settings.mode === 'single' ? (
          <div className="relative flex items-center justify-center w-full max-w-5xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getProxiedImageUrl(pages[currentPage], chapterData?.referer)}
              alt={`Halaman ${currentPage + 1}`}
              className={fitClass}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPage(settings.direction === 'rtl' ? currentPage + 1 : currentPage - 1);
              }}
              className="absolute left-0 inset-y-0 w-1/4 flex items-center justify-start pl-3 opacity-0 hover:opacity-100 transition"
              aria-label="Halaman sebelumnya"
            >
              <span className="rounded-full bg-[#111114]/80 p-2 text-white">
                <ChevronLeft className="h-6 w-6" />
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPage(settings.direction === 'rtl' ? currentPage - 1 : currentPage + 1);
              }}
              className="absolute right-0 inset-y-0 w-1/4 flex items-center justify-end pr-3 opacity-0 hover:opacity-100 transition"
              aria-label="Halaman berikutnya"
            >
              <span className="rounded-full bg-[#111114]/80 p-2 text-white">
                <ChevronRight className="h-6 w-6" />
              </span>
            </button>
          </div>
        ) : (
          <div
            className={`flex items-center justify-center gap-2 max-w-6xl mx-auto ${
              settings.direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            {[pages[currentPage], pages[currentPage + 1]].filter(Boolean).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={getProxiedImageUrl(src, chapterData?.referer)}
                alt={`Halaman ${currentPage + i + 1}`}
                className="max-h-[88vh] w-auto max-w-[48vw] object-contain"
              />
            ))}
          </div>
        )}

        {/* End of Chapter Nav */}
        {!loading && pages.length > 0 && (
          <div
            className="mt-10 mb-20 flex flex-wrap items-center justify-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {prevChapter && (
              <button
                type="button"
                onClick={() => onSelectChapter(prevChapter)}
                className="h-11 rounded-xl border border-[#303039] bg-[#19191f] px-4 text-sm font-medium text-[#f5f4f2] hover:bg-[#22222a] transition-colors"
              >
                {prevChapter.title}
              </button>
            )}
            {nextChapter && (
              <button
                type="button"
                onClick={() => onSelectChapter(nextChapter)}
                className="h-11 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 text-sm font-semibold text-[#111114] transition-colors"
              >
                Lanjut: {nextChapter.title}
              </button>
            )}
          </div>
        )}
      </main>

      {/* Bottom Toolbar */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-30 bg-[#111114]/95 border-t border-[#303039] px-4 py-2.5 transition-transform duration-200 ${
          showToolbar ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            type="button"
            disabled={!prevChapter}
            onClick={() => prevChapter && onSelectChapter(prevChapter)}
            className="h-9 rounded-lg px-3 text-xs font-medium bg-[#19191f] border border-[#303039] text-[#f5f4f2] disabled:opacity-35 hover:bg-[#22222a] flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Prev Ch</span>
          </button>

          {settings.mode !== 'webtoon' && totalPages > 0 ? (
            <div className="flex-1 flex items-center gap-3">
              <span className="text-xs font-mono tabular-nums text-[#a3a3aa] w-14 text-right">
                {currentPage + 1}/{totalPages}
              </span>
              <input
                type="range"
                aria-label="Navigasi halaman"
                min={0}
                max={Math.max(0, totalPages - 1)}
                value={currentPage}
                onChange={(e) => goToPage(Number(e.target.value))}
                className="flex-1 accent-[var(--accent)]"
              />
            </div>
          ) : (
            <div className="flex-1 text-center text-xs text-[#a3a3aa] tabular-nums">
              {totalPages > 0 ? `${totalPages} Halaman · Tekan H untuk Mode Fokus` : 'Reader'}
            </div>
          )}

          <button
            type="button"
            disabled={!nextChapter}
            onClick={() => nextChapter && onSelectChapter(nextChapter)}
            className="h-9 rounded-lg px-3 text-xs font-semibold bg-[var(--accent)] text-[#111114] disabled:opacity-35 hover:bg-[var(--accent-hover)] flex items-center gap-1"
          >
            <span className="hidden sm:inline">Next Ch</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </footer>

      {/* Reader Settings Drawer */}
      {settingsOpen && (
        <div
          className="fixed right-4 top-14 z-40 w-80 rounded-2xl border border-[#303039] bg-[#19191f] p-4 shadow-2xl space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h4 className="font-heading text-sm font-bold text-[#f5f4f2] flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
              Pengaturan Reader
            </h4>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              aria-label="Tutup pengaturan"
              className="text-[#a3a3aa] hover:text-[#f5f4f2]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#a3a3aa]">Mode Baca</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'webtoon', label: 'Vertikal', icon: ScrollText },
                  { id: 'single', label: '1 Page', icon: Eye },
                  { id: 'double', label: '2 Page', icon: Columns2 },
                ] as Array<{ id: ReadingMode; label: string; icon: typeof Eye }>
              ).map((m) => {
                const Icon = m.icon;
                const active = settings.mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onUpdateSettings({ mode: m.id })}
                    className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-xs font-medium transition-colors ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[#f5f4f2]'
                        : 'border-[#303039] bg-[#111114] text-[#a3a3aa] hover:text-[#f5f4f2]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#a3a3aa]">Lebar Gambar</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['auto', '70', '85', '100'] as ImageWidthOption[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onUpdateSettings({ imageWidth: w })}
                  className={`rounded-lg border py-1.5 text-xs font-medium ${
                    settings.imageWidth === w
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[#f5f4f2]'
                      : 'border-[#303039] bg-[#111114] text-[#a3a3aa]'
                  }`}
                >
                  {w === 'auto' ? 'Auto' : `${w}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#a3a3aa]">Jarak Antar Gambar</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { val: 0, label: 'None' },
                { val: 8, label: 'Small' },
                { val: 16, label: 'Med' },
                { val: 28, label: 'Large' },
              ].map((g) => (
                <button
                  key={g.val}
                  type="button"
                  onClick={() => onUpdateSettings({ pageGap: g.val })}
                  className={`rounded-lg border py-1.5 text-xs font-medium ${
                    settings.pageGap === g.val
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[#f5f4f2]'
                      : 'border-[#303039] bg-[#111114] text-[#a3a3aa]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#a3a3aa]">Latar Belakang</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { id: '#000000', label: 'Hitam' },
                  { id: '#111114', label: 'Gelap' },
                  { id: '#27272c', label: 'Abu' },
                  { id: '#f5f4f2', label: 'Putih' },
                ] as const
              ).map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => onUpdateSettings({ backgroundColor: bg.id })}
                  className={`rounded-lg border py-1.5 text-xs font-medium ${
                    settings.backgroundColor === bg.id
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[#f5f4f2]'
                      : 'border-[#303039] bg-[#111114] text-[#a3a3aa]'
                  }`}
                >
                  {bg.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
