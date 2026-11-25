'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLenis } from 'lenis/react';
import {
  BookMarked,
  BookOpen,
  Download,
  History,
  Home,
  Layers,
  Palette,
  Play,
  Puzzle,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  User,
  Zap,
} from 'lucide-react';
import type {
  ChapterPages,
  ChapterSummary,
  ComicDetail,
  ComicStatus,
  ComicSummary,
  ComicType,
  ExtensionManifest,
  SourceSearchResult,
} from '@/lib/types';
import { getProxiedImageUrl, useComixStore } from '@/lib/storage';
import {
  type AdaptiveThemeName,
  applyAdaptiveTheme,
  extractThemeFromImage,
} from '@/lib/adaptive-theme';
import { ComicCard } from '@/components/ComicCard';
import { ComicDetailModal } from '@/components/ComicDetailModal';
import { ComicReader } from '@/components/ComicReader';
import { ExtensionsView } from '@/components/ExtensionsView';
import { ScrollRevealTitle } from '@/components/ScrollRevealTitle';

type NavTab = 'home' | 'library' | 'extensions' | 'profile';

const GENRE_CHIPS = [
  'Action',
  'Fantasy',
  'Romance',
  'Adventure',
  'Drama',
  'Comedy',
  'Horror',
  'Sci-Fi',
];

export function ComixCiaApp() {
  const store = useComixStore();
  const lenis = useLenis();
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [builtinExtensions, setBuiltinExtensions] = useState<ExtensionManifest[]>([]);

  // Search / Explore / Updates state
  const [searchQuery, setSearchQuery] = useState('');
  const [browseMode, setBrowseMode] = useState<'popular' | 'latest' | 'search'>('popular');
  const [typeFilter, setTypeFilter] = useState<ComicType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ComicStatus | 'all'>('all');
  const [genreFilter, setGenreFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'default' | 'az'>('default');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('all');
  const [groupBySource, setGroupBySource] = useState(true);
  const [searchResults, setSearchResults] = useState<SourceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Featured carousel index
  const [featuredIndex, setFeaturedIndex] = useState(0);

  // Library state
  const [activeCategory, setActiveCategory] = useState('default');
  const [librarySearch, setLibrarySearch] = useState('');

  // Detail & Reader state
  const [selectedSummary, setSelectedSummary] = useState<ComicSummary | null>(null);
  const [comicDetail, setComicDetail] = useState<ComicDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [activeChapter, setActiveChapter] = useState<ChapterSummary | null>(null);
  const [chapterPages, setChapterPages] = useState<ChapterPages | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);

  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [manualTheme, setManualTheme] = useState<AdaptiveThemeName | 'auto'>('auto');

  const allExtensions = useMemo(
    () => [...builtinExtensions, ...store.customExtensions],
    [builtinExtensions, store.customExtensions]
  );

  // Always reset scroll to top (desktop & mobile) when opening comic detail or switching tabs
  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [selectedSummary, activeTab, lenis]);

  useEffect(() => {
    fetch('/api/extensions')
      .then((r) => r.json())
      .then((json: { extensions?: ExtensionManifest[] }) => {
        if (json.extensions) setBuiltinExtensions(json.extensions);
      })
      .catch(() => {});
  }, []);

  const runBrowseOrSearch = useCallback(
    async (
      modeOverride?: 'popular' | 'latest' | 'search',
      queryOverride?: string,
      genreOverride?: string
    ) => {
      if (!store.hydrated) return;
      const effectiveMode = modeOverride || browseMode;
      const effectiveQuery = queryOverride ?? searchQuery;
      const effectiveGenre = genreOverride ?? genreFilter;

      const targetSources =
        selectedSourceFilter === 'all'
          ? store.activeExtensionIds
          : [selectedSourceFilter];

      if (targetSources.length === 0) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: effectiveMode,
            query: effectiveQuery,
            sourceIds: targetSources,
            filters: {
              type: typeFilter,
              status: statusFilter,
              genre: effectiveGenre || undefined,
              lang: 'id',
              page: 1,
            },
            customExtensions: store.customExtensions,
            baseUrlOverrides: store.baseUrlOverrides,
          }),
        });
        const json = (await res.json()) as { results?: SourceSearchResult[] };
        if (json.results) {
          setSearchResults(json.results);
        }
      } catch {
        // handled in UI
      } finally {
        setSearching(false);
      }
    },
    [
      store.hydrated,
      store.activeExtensionIds,
      store.customExtensions,
      store.baseUrlOverrides,
      browseMode,
      searchQuery,
      genreFilter,
      selectedSourceFilter,
      typeFilter,
      statusFilter,
    ]
  );

  useEffect(() => {
    if (!store.hydrated || searchResults.length > 0) return;
    const id = window.requestAnimationFrame(() => {
      void runBrowseOrSearch('popular', '');
    });
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.hydrated]);

  const allComicsFlat = useMemo(() => {
    const list = searchResults.flatMap((g) => g.items);
    if (sortOrder === 'az') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [searchResults, sortOrder]);

  const featuredCandidates = useMemo(
    () => allComicsFlat.filter((c) => Boolean(c.coverUrl)).slice(0, 5),
    [allComicsFlat]
  );

  const featuredComic =
    featuredCandidates[featuredIndex % Math.max(1, featuredCandidates.length)] || null;

  // Apply adaptive artwork theme from Featured Story when on Home
  useEffect(() => {
    if (manualTheme !== 'auto') {
      applyAdaptiveTheme(manualTheme);
      return;
    }
    if (selectedSummary || activeTab !== 'home' || !featuredComic?.coverUrl) return;
    let active = true;
    const proxied = getProxiedImageUrl(featuredComic.coverUrl);
    extractThemeFromImage(proxied).then((theme) => {
      if (active) applyAdaptiveTheme(theme);
    });
    return () => {
      active = false;
    };
  }, [manualTheme, selectedSummary, activeTab, featuredComic]);

  const handleOpenComic = async (summary: ComicSummary) => {
    setSelectedSummary(summary);
    setComicDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const customManifest = store.customExtensions.find((c) => c.id === summary.sourceId);
      const res = await fetch('/api/comic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: summary.sourceId,
          url: summary.url,
          customManifest,
          baseUrlOverride: store.baseUrlOverrides[summary.sourceId],
        }),
      });
      const json = (await res.json()) as { detail?: ComicDetail; error?: string };
      if (!res.ok || !json.detail) {
        setDetailError(json.error || 'Gagal memuat detail komik.');
      } else {
        setComicDetail(json.detail);
      }
    } catch {
      setDetailError('Terjadi kesalahan jaringan.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReadChapter = async (detail: ComicDetail, chapter: ChapterSummary) => {
    setActiveChapter(chapter);
    setChapterPages(null);
    setChapterError(null);
    setChapterLoading(true);
    try {
      const customManifest = store.customExtensions.find((c) => c.id === detail.sourceId);
      const res = await fetch('/api/chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: detail.sourceId,
          url: chapter.url,
          customManifest,
          baseUrlOverride: store.baseUrlOverrides[detail.sourceId],
        }),
      });
      const json = (await res.json()) as { chapter?: ChapterPages; error?: string };
      if (!res.ok || !json.chapter) {
        setChapterError(json.error || 'Gagal memuat halaman chapter.');
      } else {
        setChapterPages(json.chapter);
        store.recordHistory(detail, chapter, 0, json.chapter.pages.length);
      }
    } catch {
      setChapterError('Gagal menghubungi server reader.');
    } finally {
      setChapterLoading(false);
    }
  };

  const filteredLibrary = useMemo(() => {
    return store.library.filter((entry) => {
      const matchesCat =
        activeCategory === 'default' || entry.categoryIds.includes(activeCategory);
      const matchesQuery =
        !librarySearch.trim() ||
        entry.comic.title.toLowerCase().includes(librarySearch.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [store.library, activeCategory, librarySearch]);

  const navItems: Array<{ id: NavTab; label: string; icon: typeof Home; badge?: number }> = [
    { id: 'home', label: 'Beranda', icon: Home },
    { id: 'library', label: 'Koleksi', icon: BookMarked, badge: store.library.length || undefined },
    {
      id: 'extensions',
      label: 'Extensions',
      icon: Puzzle,
      badge: store.activeExtensionIds.length || undefined,
    },
    { id: 'profile', label: 'Profil', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#111114] text-[#f5f4f2] flex flex-col">
      {/* Desktop Top Navigation (Premium Editorial) */}
      <header className="sticky top-0 z-30 border-b border-[#303039] bg-[#111114]/95 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => {
                setSelectedSummary(null);
                setActiveTab('home');
              }}
              className="flex items-center gap-2.5 text-left"
            >
              <div className="h-9 w-9 rounded-xl bg-[var(--accent)] flex items-center justify-center transition-colors duration-200">
                <BookOpen className="h-4 w-4 text-[#111114]" aria-hidden="true" />
              </div>
              <span className="font-heading text-lg font-extrabold tracking-tight text-[#f5f4f2]">
                ComixCia
              </span>
            </button>

            <nav className="hidden md:flex items-center gap-1" aria-label="Navigasi utama">
              {navItems.map((item) => {
                const active = activeTab === item.id && !selectedSummary;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedSummary(null);
                      setActiveTab(item.id);
                    }}
                    className={`h-10 px-3.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      active
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'text-[#a3a3aa] hover:text-[#f5f4f2] hover:bg-[#19191f]'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="rounded-md bg-[#22222a] px-1.5 py-0.5 text-[10px] tabular-nums text-[#f5f4f2]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Search Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSelectedSummary(null);
              setActiveTab('home');
              const mode = searchQuery.trim() ? 'search' : 'popular';
              setBrowseMode(mode);
              void runBrowseOrSearch(mode, searchQuery);
            }}
            className="flex-1 max-w-xs sm:max-w-sm"
          >
            <div className="relative">
              <Search
                className="h-4 w-4 text-[#a3a3aa] absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Cari komik"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari komik Bahasa Indonesia..."
                className="w-full h-10 rounded-xl border border-[#303039] bg-[#19191f] pl-10 pr-4 text-xs sm:text-sm text-[#f5f4f2] placeholder:text-[#a3a3aa]/70"
              />
            </div>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24 md:pb-12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
          {selectedSummary && !activeChapter ? (
            <ComicDetailModal
              summary={selectedSummary}
              detail={comicDetail}
              loading={detailLoading}
              error={detailError}
              inLibrary={store.isInLibrary(selectedSummary.sourceId, selectedSummary.url)}
              categories={store.categories}
              currentCategoryId={
                store.library
                  .find(
                    (l) =>
                      l.comic.sourceId === selectedSummary.sourceId &&
                      l.comic.url === selectedSummary.url
                  )
                  ?.categoryIds.find((c) => c !== 'default')
              }
              lastReadChapterId={
                store.library.find(
                  (l) =>
                    l.comic.sourceId === selectedSummary.sourceId &&
                    l.comic.url === selectedSummary.url
                )?.lastReadChapterId
              }
              onToggleLibrary={store.toggleLibrary}
              onChangeLibraryCategory={store.setLibraryCategory}
              onReadChapter={handleReadChapter}
              onClose={() => setSelectedSummary(null)}
            />
          ) : (
            <>
              {/* TAB: BERANDA (EDITORIAL DISCOVERY) */}
              {activeTab === 'home' && (
                <div className="space-y-10">
                  {/* Featured Story Hero */}
                  {featuredComic ? (
                    <section className="relative overflow-hidden rounded-2xl border border-[#303039] bg-[#19191f] p-6 sm:p-10 min-h-[320px] flex items-end">
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 opacity-30 blur-xl scale-105 transition-all duration-500"
                        style={{
                          backgroundImage: `url(${getProxiedImageUrl(featuredComic.coverUrl)})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center top',
                        }}
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-r from-[#111114] via-[#111114]/85 to-transparent"
                      />

                      <div className="relative z-10 w-full flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 max-w-3xl">
                          <div className="w-32 sm:w-40 shrink-0 rounded-xl overflow-hidden border border-[#303039] bg-[#22222a] shadow-xl">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getProxiedImageUrl(featuredComic.coverUrl)}
                              alt={featuredComic.title}
                              className="w-full aspect-[3/4] object-cover"
                            />
                          </div>

                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="rounded-md bg-[var(--accent-soft)] border border-[var(--accent)]/40 px-2.5 py-0.5 font-semibold text-[var(--accent)] uppercase">
                                Sorotan Utama
                              </span>
                              <span className="rounded-md bg-[#22222a] border border-[#303039] px-2.5 py-0.5 text-[#a3a3aa]">
                                {featuredComic.sourceName || featuredComic.sourceId}
                              </span>
                              {featuredComic.latestChapter && (
                                <span className="text-xs text-[#a3a3aa] tabular-nums">
                                  {featuredComic.latestChapter}
                                </span>
                              )}
                            </div>

                            <ScrollRevealTitle
                              text={featuredComic.title}
                              as="h1"
                              className="font-heading text-2xl sm:text-4xl font-extrabold text-[#f5f4f2] leading-tight"
                            />

                            {featuredComic.genres && featuredComic.genres.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {featuredComic.genres.slice(0, 4).map((g) => (
                                  <span
                                    key={g}
                                    className="rounded-lg bg-[#22222a]/90 border border-[#303039] px-2.5 py-1 text-[11px] text-[#a3a3aa]"
                                  >
                                    {g}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="pt-2 flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleOpenComic(featuredComic)}
                                className="inline-flex items-center gap-2 h-11 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 text-sm font-semibold text-[#111114] transition-colors"
                              >
                                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                                Baca Sekarang
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenComic(featuredComic)}
                                className="inline-flex items-center gap-2 h-11 rounded-xl border border-[#303039] bg-[#22222a] hover:bg-[#303039] px-5 text-sm font-medium text-[#f5f4f2] transition-colors"
                              >
                                Lihat Detail
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Featured Switcher */}
                        {featuredCandidates.length > 1 && (
                          <div className="flex items-center gap-2">
                            {featuredCandidates.map((c, idx) => (
                              <button
                                key={`${c.sourceId}-${c.id}`}
                                type="button"
                                aria-label={`Sorotan ${idx + 1}: ${c.title}`}
                                onClick={() => setFeaturedIndex(idx)}
                                className={`h-2.5 rounded-full transition-all ${
                                  featuredIndex % featuredCandidates.length === idx
                                    ? 'w-8 bg-[var(--accent)]'
                                    : 'w-2.5 bg-[#303039] hover:bg-[#a3a3aa]'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  ) : (
                    <div className="h-72 rounded-2xl border border-[#303039] bg-[#19191f] animate-pulse" />
                  )}

                  {/* Continue Reading */}
                  {store.history.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <ScrollRevealTitle
                          text="Lanjut Baca"
                          as="h2"
                          className="font-heading text-lg font-bold text-[#f5f4f2]"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveTab('library')}
                          className="text-xs font-medium text-[var(--accent)] hover:underline"
                        >
                          Lihat Semua
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {store.history.slice(0, 3).map((h) => {
                          const pct =
                            h.totalPages > 0
                              ? Math.min(100, Math.round(((h.pageIndex + 1) / h.totalPages) * 100))
                              : 0;
                          return (
                            <button
                              key={`${h.comic.sourceId}-${h.comic.url}-${h.readAt}`}
                              type="button"
                              onClick={() => handleOpenComic(h.comic)}
                              className="flex items-center gap-4 rounded-xl border border-[#303039] bg-[#19191f] p-3.5 text-left hover:border-[var(--accent)] transition-colors"
                            >
                              <div className="h-20 w-14 shrink-0 rounded-lg overflow-hidden bg-[#22222a]">
                                {h.comic.coverUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={getProxiedImageUrl(h.comic.coverUrl)}
                                    alt={h.comic.title}
                                    className="h-full w-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <p className="font-heading truncate text-sm font-bold text-[#f5f4f2]">
                                  {h.comic.title}
                                </p>
                                <p className="truncate text-xs text-[var(--accent)]">
                                  {h.chapter.title}
                                </p>
                                <div className="w-full h-1.5 rounded-full bg-[#22222a] overflow-hidden">
                                  <div
                                    className="h-full bg-[var(--accent)] transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Katalog & Filter Komik (Terintegrasi di Beranda) */}
                  <section className="space-y-6">
                    <div className="rounded-2xl border border-[#303039] bg-[#19191f] p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <ScrollRevealTitle
                          text="Katalog Komik"
                          as="h2"
                          className="font-heading text-xl font-extrabold text-[#f5f4f2]"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setGroupBySource((v) => !v)}
                            className="inline-flex items-center gap-1.5 h-10 rounded-xl border border-[#303039] bg-[#111114] px-3.5 text-xs font-medium text-[#f5f4f2] hover:bg-[#22222a]"
                          >
                            <Layers className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                            {groupBySource ? 'Per Sumber' : 'Gabungan'}
                          </button>
                          <button
                            type="button"
                            onClick={() => runBrowseOrSearch()}
                            aria-label="Muat ulang katalog"
                            className="h-10 w-10 rounded-xl border border-[#303039] bg-[#111114] flex items-center justify-center text-[#a3a3aa] hover:text-[#f5f4f2]"
                          >
                            <RefreshCw className={`h-4 w-4 ${searching ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Filter Row */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        {(
                          [
                            { id: 'popular', label: 'Terpopuler' },
                            { id: 'latest', label: 'Rilis Terbaru' },
                          ] as const
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setBrowseMode(m.id);
                              void runBrowseOrSearch(m.id, searchQuery);
                            }}
                            className={`h-10 rounded-xl px-4 text-xs font-semibold transition-colors ${
                              browseMode === m.id
                                ? 'bg-[var(--accent)] text-[#111114]'
                                : 'bg-[#111114] border border-[#303039] text-[#a3a3aa] hover:text-[#f5f4f2]'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}

                        <select
                          aria-label="Filter tipe komik"
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value as ComicType | 'all')}
                          className="h-10 rounded-xl border border-[#303039] bg-[#111114] px-3 text-xs text-[#f5f4f2]"
                        >
                          <option value="all">Semua Tipe</option>
                          <option value="manhwa">Manhwa</option>
                          <option value="manga">Manga</option>
                          <option value="manhua">Manhua</option>
                        </select>

                        <select
                          aria-label="Filter status komik"
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value as ComicStatus | 'all')}
                          className="h-10 rounded-xl border border-[#303039] bg-[#111114] px-3 text-xs text-[#f5f4f2]"
                        >
                          <option value="all">Semua Status</option>
                          <option value="ongoing">Berlanjut</option>
                          <option value="completed">Tamat</option>
                        </select>

                        <select
                          aria-label="Urutkan komik"
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value as 'default' | 'az')}
                          className="h-10 rounded-xl border border-[#303039] bg-[#111114] px-3 text-xs text-[#f5f4f2]"
                        >
                          <option value="default">Urutan Default</option>
                          <option value="az">Abjad (A–Z)</option>
                        </select>

                        <select
                          aria-label="Filter sumber komik"
                          value={selectedSourceFilter}
                          onChange={(e) => setSelectedSourceFilter(e.target.value)}
                          className="h-10 rounded-xl border border-[#303039] bg-[#111114] px-3 text-xs text-[#f5f4f2]"
                        >
                          <option value="all">
                            Semua Sumber ({store.activeExtensionIds.length})
                          </option>
                          {allExtensions
                            .filter((e) => store.activeExtensionIds.includes(e.id))
                            .map((ext) => (
                              <option key={ext.id} value={ext.id}>
                                {ext.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Genre Chips */}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setGenreFilter('');
                            void runBrowseOrSearch(browseMode, searchQuery, '');
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            !genreFilter
                              ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/40'
                              : 'bg-[#111114] border border-[#303039] text-[#a3a3aa] hover:text-[#f5f4f2]'
                          }`}
                        >
                          Semua Genre
                        </button>
                        {GENRE_CHIPS.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => {
                              setGenreFilter(g);
                              void runBrowseOrSearch(browseMode, searchQuery, g);
                            }}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                              genreFilter === g
                                ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/40'
                                : 'bg-[#111114] border border-[#303039] text-[#a3a3aa] hover:text-[#f5f4f2]'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Catalog Grid */}
                    {searching && searchResults.length === 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                        {Array.from({ length: 14 }).map((_, idx) => (
                          <div key={idx} className="rounded-xl overflow-hidden bg-[#19191f] border border-[#303039] animate-pulse">
                            <div className="aspect-[3/4] bg-[#22222a]" />
                            <div className="p-3 space-y-2">
                              <div className="h-3 bg-[#22222a] rounded w-4/5" />
                              <div className="h-2.5 bg-[#22222a] rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : groupBySource ? (
                      <div className="space-y-8">
                        {searchResults.map((group) => (
                          <section key={group.sourceId} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <ScrollRevealTitle
                                text={group.sourceName}
                                as="h3"
                                className="font-heading text-base font-bold text-[#f5f4f2]"
                              />
                              <span className="text-xs text-[#a3a3aa] tabular-nums">
                                {group.items.length} judul
                              </span>
                            </div>
                            {group.error ? (
                              <div className="rounded-xl border border-[#303039] bg-[#19191f] p-4 text-xs text-[#a3a3aa]">
                                {group.sourceName}: {group.error}
                              </div>
                            ) : group.items.length === 0 ? (
                              <div className="rounded-xl border border-[#303039] bg-[#19191f] p-4 text-xs text-[#a3a3aa]">
                                Tidak ada komik ditemukan di {group.sourceName}.
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                                {group.items.slice(0, 14).map((comic) => (
                                  <ComicCard
                                    key={`${comic.sourceId}-${comic.id}`}
                                    comic={comic}
                                    inLibrary={store.isInLibrary(comic.sourceId, comic.url)}
                                    onSelect={handleOpenComic}
                                    onToggleBookmark={(c) => store.toggleLibrary(c, ['default', 'reading'])}
                                  />
                                ))}
                              </div>
                            )}
                          </section>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                        {allComicsFlat.map((comic) => (
                          <ComicCard
                            key={`${comic.sourceId}-${comic.id}`}
                            comic={comic}
                            inLibrary={store.isInLibrary(comic.sourceId, comic.url)}
                            onSelect={handleOpenComic}
                            onToggleBookmark={(c) => store.toggleLibrary(c, ['default', 'reading'])}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* TAB: KOLEKSI (LIBRARY & HISTORY) */}
              {activeTab === 'library' && (
                <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <ScrollRevealTitle
                      text={`Koleksi Pribadi (${store.library.length})`}
                      as="h1"
                      className="font-heading text-xl font-extrabold text-[#f5f4f2]"
                    />
                    <input
                      type="text"
                      aria-label="Cari di koleksi"
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      placeholder="Cari komik di koleksi..."
                      className="h-10 w-full sm:w-64 rounded-xl border border-[#303039] bg-[#19191f] px-3.5 text-xs text-[#f5f4f2]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {store.categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id)}
                        className={`h-10 rounded-xl px-4 text-xs font-semibold transition-colors ${
                          activeCategory === cat.id
                            ? 'bg-[var(--accent)] text-[#111114]'
                            : 'bg-[#19191f] border border-[#303039] text-[#a3a3aa] hover:text-[#f5f4f2]'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>

                  {filteredLibrary.length === 0 ? (
                    <div className="rounded-2xl border border-[#303039] bg-[#19191f] p-12 text-center space-y-2">
                      <BookMarked className="h-8 w-8 text-[#a3a3aa]/50 mx-auto" />
                      <p className="text-sm text-[#a3a3aa]">Belum ada komik di kategori ini.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                      {filteredLibrary.map((entry) => (
                        <ComicCard
                          key={`${entry.comic.sourceId}-${entry.comic.url}`}
                          comic={entry.comic}
                          inLibrary
                          onSelect={handleOpenComic}
                          onToggleBookmark={(c) => store.toggleLibrary(c)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Reading History */}
                  <section className="space-y-4 border-t border-[#303039] pt-8">
                    <div className="flex items-center justify-between">
                      <h2 className="font-heading text-lg font-bold text-[#f5f4f2] flex items-center gap-2">
                        <History className="h-5 w-5 text-[var(--accent)]" />
                        Riwayat Baca
                      </h2>
                      {store.history.length > 0 && (
                        <button
                          type="button"
                          onClick={store.clearHistory}
                          className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus Riwayat
                        </button>
                      )}
                    </div>

                    {store.history.length === 0 ? (
                      <p className="text-xs text-[#a3a3aa]">Belum ada riwayat bacaan.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {store.history.slice(0, 12).map((h) => (
                          <button
                            key={`${h.comic.sourceId}-${h.comic.url}-${h.readAt}`}
                            type="button"
                            onClick={() => handleOpenComic(h.comic)}
                            className="flex items-center gap-4 rounded-xl border border-[#303039] bg-[#19191f] p-3 text-left hover:border-[var(--accent)] transition-colors"
                          >
                            <div className="h-16 w-12 shrink-0 rounded-lg overflow-hidden bg-[#22222a]">
                              {h.comic.coverUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={getProxiedImageUrl(h.comic.coverUrl)}
                                  alt={h.comic.title}
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-heading truncate text-sm font-bold text-[#f5f4f2]">
                                {h.comic.title}
                              </p>
                              <p className="truncate text-xs text-[var(--accent)] mt-0.5">
                                {h.chapter.title}
                              </p>
                              <p className="text-[11px] text-[#a3a3aa] mt-0.5">
                                {h.comic.sourceName || h.comic.sourceId} •{' '}
                                {new Date(h.readAt).toLocaleString('id-ID')}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* TAB: EXTENSIONS */}
              {activeTab === 'extensions' && (
                <ExtensionsView
                  allExtensions={allExtensions}
                  installedIds={store.installedExtensionIds}
                  disabledIds={store.disabledExtensionIds}
                  baseUrlOverrides={store.baseUrlOverrides}
                  onInstall={store.installExtension}
                  onUninstall={store.uninstallExtension}
                  onToggleEnabled={store.toggleExtensionEnabled}
                  onSetBaseUrlOverride={store.setBaseUrlOverride}
                  onAddCustomExtensions={store.addCustomExtensions}
                />
              )}

              {/* TAB: PROFIL & PENGATURAN */}
              {activeTab === 'profile' && (
                <div className="max-w-3xl space-y-6">
                  <ScrollRevealTitle
                    text="Profil & Statistik"
                    as="h1"
                    className="font-heading text-xl font-extrabold text-[#f5f4f2]"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-[#303039] bg-[#19191f] p-5">
                      <p className="text-xs text-[#a3a3aa]">Komik di Koleksi</p>
                      <p className="font-heading text-2xl font-extrabold text-[#f5f4f2] mt-1 tabular-nums">
                        {store.library.length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#303039] bg-[#19191f] p-5">
                      <p className="text-xs text-[#a3a3aa]">Riwayat Dibaca</p>
                      <p className="font-heading text-2xl font-extrabold text-[#f5f4f2] mt-1 tabular-nums">
                        {store.history.length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#303039] bg-[#19191f] p-5">
                      <p className="text-xs text-[#a3a3aa]">Extension Aktif</p>
                      <p className="font-heading text-2xl font-extrabold text-[var(--accent)] mt-1 tabular-nums">
                        {store.activeExtensionIds.length}
                      </p>
                    </div>
                  </div>

                  {/* Adaptive Theme Selector */}
                  <div className="rounded-2xl border border-[#303039] bg-[#19191f] p-5 space-y-3">
                    <h2 className="font-heading text-sm font-bold text-[#f5f4f2] flex items-center gap-2">
                      <Palette className="h-4 w-4 text-[var(--accent)]" />
                      Adaptive Artwork Theme
                    </h2>
                    <p className="text-xs text-[#a3a3aa]">
                      Warna aksen otomatis mengikuti artwork komik yang dibuka, atau pilih tema aksen manual:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'auto', label: 'Otomatis (Artwork)' },
                          { id: 'crimson', label: 'Crimson' },
                          { id: 'azure', label: 'Azure' },
                          { id: 'violet', label: 'Violet' },
                          { id: 'emerald', label: 'Emerald' },
                          { id: 'amber', label: 'Amber' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setManualTheme(t.id)}
                          className={`h-10 rounded-xl px-3.5 text-xs font-semibold border transition-colors ${
                            manualTheme === t.id
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[#f5f4f2]'
                              : 'border-[#303039] bg-[#111114] text-[#a3a3aa] hover:text-[#f5f4f2]'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Backup JSON */}
                  <div className="rounded-2xl border border-[#303039] bg-[#19191f] p-5 space-y-4">
                    <h2 className="font-heading text-sm font-bold text-[#f5f4f2]">
                      Backup &amp; Restore Data
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const json = store.exportBackup();
                          const blob = new Blob([json], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `comixcia-backup-${new Date().toISOString().slice(0, 10)}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          setBackupNotice('Backup berhasil diunduh!');
                        }}
                        className="inline-flex items-center gap-2 h-11 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 text-xs font-semibold text-[#111114] transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Export Backup JSON
                      </button>

                      <label className="inline-flex items-center gap-2 h-11 rounded-xl border border-[#303039] bg-[#111114] hover:bg-[#22222a] px-4 text-xs font-semibold text-[#f5f4f2] cursor-pointer transition-colors">
                        <Upload className="h-4 w-4" />
                        Import Backup JSON
                        <input
                          type="file"
                          accept=".json,application/json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              try {
                                store.importBackup(String(reader.result));
                                setBackupNotice('Backup berhasil dipulihkan!');
                              } catch {
                                setBackupNotice('File backup tidak valid.');
                              }
                            };
                            reader.readAsText(file);
                          }}
                        />
                      </label>
                    </div>
                    {backupNotice && (
                      <p className="text-xs text-[#55b68b]">{backupNotice}</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[#303039] bg-[#19191f] p-5 space-y-1.5">
                    <h2 className="font-heading text-sm font-bold text-[#f5f4f2] flex items-center gap-2">
                      <Zap className="h-4 w-4 text-[#55b68b]" />
                      Engine Sumber Komik
                    </h2>
                    <p className="text-xs text-[#a3a3aa] leading-relaxed">
                      ComixCia berjalan 100% tanpa API key menggunakan kombinasi REST API &amp; Direct Fetch untuk sumber komik Bahasa Indonesia.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navigasi mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[#303039] bg-[#111114]/95 backdrop-blur-md flex justify-around py-1.5"
      >
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id && !selectedSummary;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedSummary(null);
                setActiveTab(item.id);
              }}
              className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 text-[11px] font-medium ${
                active ? 'text-[var(--accent)]' : 'text-[#a3a3aa]'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Distraction-Free Fullscreen Reader */}
      {comicDetail && activeChapter && (
        <ComicReader
          key={activeChapter.id}
          comic={comicDetail}
          chapter={activeChapter}
          chapterData={chapterPages}
          loading={chapterLoading}
          error={chapterError}
          settings={store.readingSettings}
          onUpdateSettings={store.updateReadingSettings}
          onSelectChapter={(ch) => handleReadChapter(comicDetail, ch)}
          onProgress={(pageIndex, totalPages) =>
            store.recordHistory(comicDetail, activeChapter, pageIndex, totalPages)
          }
          onClose={() => setActiveChapter(null)}
        />
      )}
    </div>
  );
}
