import type * as cheerio from 'cheerio';
import type {
  ChapterPages,
  ComicDetail,
  ComicStatus,
  ComicSummary,
  ComicType,
  ExtensionManifest,
  SearchFilters,
} from '@/lib/types';

export interface ExtensionResultList {
  items: ComicSummary[];
  engineUsed?: string;
}

export interface ComicExtensionAdapter {
  manifest: ExtensionManifest;
  getPopular(page?: number, filters?: SearchFilters): Promise<ExtensionResultList>;
  getLatest(page?: number): Promise<ExtensionResultList>;
  search(query: string, filters?: SearchFilters): Promise<ExtensionResultList>;
  getDetail(comicUrlOrId: string): Promise<ComicDetail>;
  getChapterPages(chapterUrlOrId: string): Promise<ChapterPages>;
}

export function normalizeComicType(raw?: string | null): ComicType {
  const val = (raw || '').toLowerCase().trim();
  if (val.includes('manhwa') || val.includes('korea') || val === 'kr' || val === 'ko') {
    return 'manhwa';
  }
  if (val.includes('manhua') || val.includes('china') || val === 'cn' || val === 'zh') {
    return 'manhua';
  }
  if (val.includes('manga') || val.includes('japan') || val === 'jp' || val === 'ja') {
    return 'manga';
  }
  if (val.includes('comic') || val.includes('webtoon')) {
    return 'comic';
  }
  return 'unknown';
}

export function normalizeComicStatus(raw?: string | null): ComicStatus {
  const val = (raw || '').toLowerCase().trim();
  if (val.includes('ongoing') || val.includes('berjalan') || val.includes('publishing')) {
    return 'ongoing';
  }
  if (val.includes('complete') || val.includes('tamat') || val.includes('end') || val.includes('finished')) {
    return 'completed';
  }
  if (val.includes('hiatus')) return 'hiatus';
  if (val.includes('cancel') || val.includes('drop')) return 'cancelled';
  return 'unknown';
}

export function extractBestImgSrc(
  $el: ReturnType<ReturnType<typeof cheerio.load>>,
  baseUrl: string
): string {
  const candidates = [
    $el.attr('data-src'),
    $el.attr('data-lazy-src'),
    $el.attr('data-original'),
    $el.attr('data-cfsrc'),
    $el.attr('srcset')?.split(',')[0]?.trim().split(' ')[0],
    $el.attr('src'),
  ];

  for (const c of candidates) {
    if (c && !c.startsWith('data:image/svg') && !c.includes('blank.gif') && !c.includes('loading')) {
      try {
        const resolved = new URL(c.trim(), baseUrl);
        if (resolved.hostname.includes('komiku') && resolved.searchParams.has('resize')) {
          resolved.searchParams.delete('resize');
        }
        return resolved.toString();
      } catch {
        return c.trim();
      }
    }
  }
  return '';
}

export function filterBySearchFilters(items: ComicSummary[], filters?: SearchFilters): ComicSummary[] {
  if (!filters) return items;
  return items.filter((item) => {
    if (filters.type && filters.type !== 'all' && item.type !== 'unknown' && item.type !== filters.type) {
      return false;
    }
    if (filters.status && filters.status !== 'all' && item.status && item.status !== 'unknown' && item.status !== filters.status) {
      return false;
    }
    if (filters.genre && filters.genre.trim()) {
      const g = filters.genre.toLowerCase();
      if (item.genres && item.genres.length > 0) {
        const hasGenre = item.genres.some((itemG) => itemG.toLowerCase().includes(g));
        if (!hasGenre) return false;
      }
    }
    return true;
  });
}
