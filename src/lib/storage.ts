'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  Category,
  ChapterSummary,
  ComicSummary,
  ExtensionManifest,
  HistoryEntry,
  LibraryEntry,
  ReadingSettings,
} from '@/lib/types';

export const DEFAULT_PREINSTALLED_IDS = [
  'mangadex',
  'webtoon',
  'komiku',
  'kiryuu',
  'luvyaa',
  'maid',
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'default', name: 'Semua' },
  { id: 'reading', name: 'Sedang Dibaca' },
  { id: 'completed', name: 'Selesai' },
  { id: 'plan', name: 'Rencana Baca' },
  { id: 'on_hold', name: 'Ditunda' },
  { id: 'favorit', name: 'Favorit' },
];

const DEFAULT_READING_SETTINGS: ReadingSettings = {
  mode: 'webtoon',
  direction: 'ltr',
  fitMode: 'width',
  imageWidth: 'auto',
  pageGap: 0,
  backgroundColor: '#111114',
  autoHideToolbar: false,
  showPageNumber: true,
};

export interface ComixStoreData {
  installedExtensionIds: string[];
  disabledExtensionIds: string[];
  baseUrlOverrides: Record<string, string>;
  customExtensions: ExtensionManifest[];
  library: LibraryEntry[];
  categories: Category[];
  history: HistoryEntry[];
  readingSettings: ReadingSettings;
}

const STORAGE_KEY = 'comixcia_store_v7';

function getInitialData(): ComixStoreData {
  return {
    installedExtensionIds: DEFAULT_PREINSTALLED_IDS,
    disabledExtensionIds: [],
    baseUrlOverrides: {},
    customExtensions: [],
    library: [],
    categories: DEFAULT_CATEGORIES,
    history: [],
    readingSettings: DEFAULT_READING_SETTINGS,
  };
}

function readFromStorage(): ComixStoreData {
  if (typeof window === 'undefined') return getInitialData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialData();
    const parsed = JSON.parse(raw) as Partial<ComixStoreData>;
    return {
      installedExtensionIds:
        parsed.installedExtensionIds?.filter((id) => id !== 'shinigami') ??
        DEFAULT_PREINSTALLED_IDS,
      disabledExtensionIds: parsed.disabledExtensionIds ?? [],
      baseUrlOverrides: parsed.baseUrlOverrides ?? {},
      customExtensions: parsed.customExtensions ?? [],
      library: parsed.library ?? [],
      categories: parsed.categories?.length ? parsed.categories : DEFAULT_CATEGORIES,
      history: parsed.history ?? [],
      readingSettings: {
        ...DEFAULT_READING_SETTINGS,
        ...(parsed.readingSettings || {}),
      },
    };
  } catch {
    return getInitialData();
  }
}

export function getProxiedImageUrl(url?: string, referer?: string): string {
  if (!url) return '';
  if (url.startsWith('/api/proxy/image') || url.startsWith('data:')) return url;
  const params = new URLSearchParams({ url });
  if (referer) params.set('referer', referer);
  return `/api/proxy/image?${params.toString()}`;
}

export function useComixStore() {
  const [data, setData] = useState<ComixStoreData>(getInitialData);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setData(readFromStorage());
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  const updateStore = useCallback(
    (updater: (prev: ComixStoreData) => ComixStoreData) => {
      setData((prev) => {
        const next = updater(prev);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
    []
  );

  const installExtension = useCallback(
    (id: string) => {
      updateStore((prev) => ({
        ...prev,
        installedExtensionIds: prev.installedExtensionIds.includes(id)
          ? prev.installedExtensionIds
          : [...prev.installedExtensionIds, id],
        disabledExtensionIds: prev.disabledExtensionIds.filter((x) => x !== id),
      }));
    },
    [updateStore]
  );

  const uninstallExtension = useCallback(
    (id: string) => {
      updateStore((prev) => ({
        ...prev,
        installedExtensionIds: prev.installedExtensionIds.filter((x) => x !== id),
        disabledExtensionIds: prev.disabledExtensionIds.filter((x) => x !== id),
        customExtensions: prev.customExtensions.filter((x) => x.id !== id),
      }));
    },
    [updateStore]
  );

  const toggleExtensionEnabled = useCallback(
    (id: string) => {
      updateStore((prev) => {
        const isDisabled = prev.disabledExtensionIds.includes(id);
        return {
          ...prev,
          disabledExtensionIds: isDisabled
            ? prev.disabledExtensionIds.filter((x) => x !== id)
            : [...prev.disabledExtensionIds, id],
        };
      });
    },
    [updateStore]
  );

  const addCustomExtensions = useCallback(
    (exts: ExtensionManifest[]) => {
      updateStore((prev) => {
        const existingMap = new Map(prev.customExtensions.map((e) => [e.id, e]));
        for (const ext of exts) {
          existingMap.set(ext.id, { ...ext, isCustom: true });
        }
        const newIds = exts.map((e) => e.id);
        const mergedInstalled = Array.from(
          new Set([...prev.installedExtensionIds, ...newIds])
        );
        return {
          ...prev,
          customExtensions: Array.from(existingMap.values()),
          installedExtensionIds: mergedInstalled,
        };
      });
    },
    [updateStore]
  );

  const toggleLibrary = useCallback(
    (comic: ComicSummary, categoryIds: string[] = ['default']) => {
      updateStore((prev) => {
        const exists = prev.library.some(
          (e) => e.comic.sourceId === comic.sourceId && e.comic.url === comic.url
        );
        if (exists) {
          return {
            ...prev,
            library: prev.library.filter(
              (e) => !(e.comic.sourceId === comic.sourceId && e.comic.url === comic.url)
            ),
          };
        }
        return {
          ...prev,
          library: [
            { comic, addedAt: Date.now(), categoryIds },
            ...prev.library,
          ],
        };
      });
    },
    [updateStore]
  );

  const setLibraryCategory = useCallback(
    (sourceId: string, url: string, categoryId: string) => {
      updateStore((prev) => ({
        ...prev,
        library: prev.library.map((entry) =>
          entry.comic.sourceId === sourceId && entry.comic.url === url
            ? { ...entry, categoryIds: ['default', categoryId] }
            : entry
        ),
      }));
    },
    [updateStore]
  );

  const isInLibrary = useCallback(
    (sourceId: string, url: string) =>
      data.library.some((e) => e.comic.sourceId === sourceId && e.comic.url === url),
    [data.library]
  );

  const recordHistory = useCallback(
    (
      comic: ComicSummary,
      chapter: ChapterSummary,
      pageIndex: number,
      totalPages: number
    ) => {
      updateStore((prev) => {
        const filteredHistory = prev.history.filter(
          (h) => !(h.comic.sourceId === comic.sourceId && h.comic.url === comic.url)
        );
        const newEntry: HistoryEntry = {
          comic,
          chapter,
          pageIndex,
          totalPages,
          readAt: Date.now(),
        };

        const updatedLibrary = prev.library.map((lib) => {
          if (lib.comic.sourceId === comic.sourceId && lib.comic.url === comic.url) {
            return {
              ...lib,
              lastReadChapterId: chapter.id,
              lastReadChapterTitle: chapter.title,
              lastReadAt: Date.now(),
            };
          }
          return lib;
        });

        return {
          ...prev,
          history: [newEntry, ...filteredHistory].slice(0, 150),
          library: updatedLibrary,
        };
      });
    },
    [updateStore]
  );

  const addCategory = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      const id = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      updateStore((prev) => {
        if (prev.categories.some((c) => c.id === id)) return prev;
        return { ...prev, categories: [...prev.categories, { id, name: clean }] };
      });
    },
    [updateStore]
  );

  const updateReadingSettings = useCallback(
    (patch: Partial<ReadingSettings>) => {
      updateStore((prev) => ({
        ...prev,
        readingSettings: { ...prev.readingSettings, ...patch },
      }));
    },
    [updateStore]
  );

  const clearHistory = useCallback(() => {
    updateStore((prev) => ({ ...prev, history: [] }));
  }, [updateStore]);

  const exportBackup = useCallback(() => {
    return JSON.stringify(
      {
        app: 'ComixCia',
        version: 1,
        exportedAt: new Date().toISOString(),
        data,
      },
      null,
      2
    );
  }, [data]);

  const importBackup = useCallback(
    (jsonStr: string) => {
      const parsed = JSON.parse(jsonStr) as { data?: Partial<ComixStoreData> } & Partial<ComixStoreData>;
      const payload = parsed.data || parsed;
      updateStore((prev) => ({
        ...prev,
        ...payload,
        readingSettings: {
          ...prev.readingSettings,
          ...(payload.readingSettings || {}),
        },
      }));
    },
    [updateStore]
  );

  const setBaseUrlOverride = useCallback(
    (sourceId: string, newBaseUrl: string) => {
      updateStore((prev) => {
        const next = { ...prev.baseUrlOverrides };
        const cleaned = newBaseUrl.trim().replace(/\/$/, '');
        if (cleaned) {
          next[sourceId] = cleaned;
        } else {
          delete next[sourceId];
        }
        return { ...prev, baseUrlOverrides: next };
      });
    },
    [updateStore]
  );

  const activeExtensionIds = data.installedExtensionIds.filter(
    (id) => !data.disabledExtensionIds.includes(id)
  );

  return {
    ...data,
    hydrated,
    activeExtensionIds,
    installExtension,
    uninstallExtension,
    toggleExtensionEnabled,
    setBaseUrlOverride,
    addCustomExtensions,
    toggleLibrary,
    setLibraryCategory,
    isInLibrary,
    recordHistory,
    addCategory,
    updateReadingSettings,
    clearHistory,
    exportBackup,
    importBackup,
  };
}
