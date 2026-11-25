export type ComicType = 'manga' | 'manhwa' | 'manhua' | 'comic' | 'unknown';

export type ComicStatus = 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'unknown';

export type ExtensionLang = 'id' | 'en' | 'jp' | 'multi';

export type ScraperEngine = 'rest-api' | 'direct-html' | 'custom-css';

export interface CustomExtensionConfig {
  popularUrl: string;
  latestUrl?: string;
  searchUrl: string; // Use {query} placeholder
  itemSelector: string;
  titleSelector: string;
  urlSelector: string;
  coverSelector: string;
  typeDefault?: ComicType;
  chapterListSelector: string;
  chapterTitleSelector?: string;
  chapterUrlSelector?: string;
  pageImageSelector: string;
  referer?: string;
}

export interface ExtensionManifest {
  id: string;
  name: string;
  baseUrl: string;
  lang: ExtensionLang;
  nsfw?: boolean;
  version: string;
  description: string;
  types: ComicType[];
  isPreinstalled: boolean;
  isCustom?: boolean;
  scraperEngine: ScraperEngine;
  accentColor: string;
  customConfig?: CustomExtensionConfig;
}

export interface ComicSummary {
  id: string;
  sourceId: string;
  sourceName?: string;
  title: string;
  url: string;
  coverUrl: string;
  type: ComicType;
  status?: ComicStatus;
  latestChapter?: string;
  rating?: string;
  genres?: string[];
  author?: string;
  lang?: ExtensionLang;
  contentRating?: 'safe' | 'suggestive' | 'erotica' | 'pornographic';
}

export interface ChapterSummary {
  id: string;
  title: string;
  number?: string;
  url: string;
  uploadedAt?: string;
  scanlator?: string;
}

export interface ComicDetail extends ComicSummary {
  synopsis: string;
  altTitles?: string[];
  artist?: string;
  chapters: ChapterSummary[];
}

export interface ChapterPages {
  chapterId: string;
  sourceId: string;
  comicTitle: string;
  chapterTitle: string;
  pages: string[];
  nextChapterUrl?: string | null;
  prevChapterUrl?: string | null;
  referer?: string;
}

export interface SearchFilters {
  query?: string;
  type?: ComicType | 'all';
  status?: ComicStatus | 'all';
  genre?: string;
  lang?: ExtensionLang | 'all';
  page?: number;
}

export interface SourceSearchResult {
  sourceId: string;
  sourceName: string;
  lang: ExtensionLang;
  engineUsed?: string;
  items: ComicSummary[];
  error?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface LibraryEntry {
  comic: ComicSummary;
  addedAt: number;
  categoryIds: string[];
  lastReadChapterId?: string;
  lastReadChapterTitle?: string;
  lastReadAt?: number;
}

export interface HistoryEntry {
  comic: ComicSummary;
  chapter: ChapterSummary;
  pageIndex: number;
  totalPages: number;
  readAt: number;
}

export type ReadingMode = 'webtoon' | 'single' | 'double';
export type ReadingDirection = 'ltr' | 'rtl';
export type FitMode = 'width' | 'height' | 'original';
export type ImageWidthOption = 'auto' | '70' | '85' | '100';

export interface ReadingSettings {
  mode: ReadingMode;
  direction: ReadingDirection;
  fitMode: FitMode;
  imageWidth: ImageWidthOption;
  pageGap: number;
  backgroundColor: '#000000' | '#111114' | '#27272c' | '#f5f4f2';
  autoHideToolbar: boolean;
  showPageNumber: boolean;
}
