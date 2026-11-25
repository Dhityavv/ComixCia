import type {
  ChapterPages,
  ChapterSummary,
  ComicDetail,
  ComicSummary,
  ComicType,
  ExtensionManifest,
  SearchFilters,
} from '@/lib/types';
import {
  type ComicExtensionAdapter,
  type ExtensionResultList,
  normalizeComicStatus,
} from '@/lib/extensions/types';
import { scraperCache } from '@/lib/scraper/http-client';

const API_BASE = 'https://api.mangadex.org';

export const mangadexManifest: ExtensionManifest = {
  id: 'mangadex',
  name: 'MangaDex ID',
  baseUrl: 'https://mangadex.org',
  lang: 'id',
  version: '1.4.0',
  description: 'MangaDex REST API — Khusus Komik Bahasa Indonesia',
  types: ['manga', 'manhwa', 'manhua'],
  isPreinstalled: true,
  scraperEngine: 'rest-api',
  accentColor: '#FF6740',
};

interface MangaDexManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles?: Array<Record<string, string>>;
    description?: Record<string, string>;
    originalLanguage?: string;
    status?: string;
    contentRating?: 'safe' | 'suggestive' | 'erotica' | 'pornographic';
    lastChapter?: string | null;
    tags?: Array<{ attributes: { name: Record<string, string> } }>;
  };
  relationships: Array<{
    id: string;
    type: string;
    attributes?: { fileName?: string; name?: string };
  }>;
}

function mapOriginalLangToType(lang?: string): ComicType {
  if (lang === 'ko') return 'manhwa';
  if (lang === 'zh' || lang === 'zh-hk') return 'manhua';
  if (lang === 'ja') return 'manga';
  return 'manga';
}

function pickTitle(
  titles: Record<string, string> | undefined,
  altTitles?: Array<Record<string, string>>
): string {
  if (!titles) return 'Tanpa Judul';
  const altId = altTitles?.find((t) => t.id)?.id;
  const altEn = altTitles?.find((t) => t.en)?.en;
  return (
    titles.id ||
    titles.en ||
    altId ||
    altEn ||
    titles['ja-ro'] ||
    titles['ko-ro'] ||
    Object.values(titles)[0] ||
    'Tanpa Judul'
  );
}

function cleanSynopsis(raw?: string): string {
  if (!raw) return 'Tidak ada sinopsis.';
  // Cut off MangaDex metadata/external-links section after ---
  const beforeDivider = raw.split(/\r?\n\s*---+/)[0] || raw;
  return (
    beforeDivider
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`>#]/g, '')
      .replace(/\s*---\s*\[[\s\S]*$/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim() || 'Tidak ada sinopsis.'
  );
}

function mapMangaToSummary(m: MangaDexManga): ComicSummary {
  const coverRel = m.relationships.find((r) => r.type === 'cover_art');
  const authorRel = m.relationships.find((r) => r.type === 'author');
  const fileName = coverRel?.attributes?.fileName;
  const coverUrl = fileName
    ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.512.jpg`
    : '';

  return {
    id: m.id,
    sourceId: mangadexManifest.id,
    sourceName: mangadexManifest.name,
    title: pickTitle(m.attributes.title, m.attributes.altTitles),
    url: m.id,
    coverUrl,
    type: mapOriginalLangToType(m.attributes.originalLanguage),
    status: normalizeComicStatus(m.attributes.status),
    latestChapter: m.attributes.lastChapter ? `Ch. ${m.attributes.lastChapter}` : undefined,
    genres:
      m.attributes.tags
        ?.map((t) => t.attributes.name.id || t.attributes.name.en || Object.values(t.attributes.name)[0])
        .filter(Boolean)
        .slice(0, 6) || [],
    author: authorRel?.attributes?.name,
    lang: 'id',
    contentRating: m.attributes.contentRating,
  };
}

async function fetchMangaList(params: URLSearchParams): Promise<ExtensionResultList> {
  const cacheKey = `md:list:v2:${params.toString()}`;
  const cached = scraperCache.get<ExtensionResultList>(cacheKey);
  if (cached) return { ...cached, engineUsed: 'cache' };

  const res = await fetch(`${API_BASE}/manga?${params.toString()}`, {
    headers: { 'User-Agent': 'ComixCia/1.0' },
  });
  if (!res.ok) throw new Error(`MangaDex API ${res.status}`);
  const json = (await res.json()) as { data?: MangaDexManga[] };
  const items = (json.data || []).map(mapMangaToSummary);
  const result = { items, engineUsed: 'rest-api' };
  scraperCache.set(cacheKey, result, 5 * 60 * 1000);
  return result;
}

function buildFilterParams(page = 1, filters?: SearchFilters): URLSearchParams {
  const limit = 24;
  const offset = (Math.max(1, page) - 1) * limit;
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  params.append('includes[]', 'cover_art');
  params.append('includes[]', 'author');
  params.append('contentRating[]', 'safe');
  params.append('contentRating[]', 'suggestive');
  params.append('availableTranslatedLanguage[]', 'id');
  params.set('hasAvailableChapters', 'true');

  if (filters?.type === 'manhwa') params.append('originalLanguage[]', 'ko');
  if (filters?.type === 'manhua') {
    params.append('originalLanguage[]', 'zh');
    params.append('originalLanguage[]', 'zh-hk');
  }
  if (filters?.type === 'manga') params.append('originalLanguage[]', 'ja');
  if (filters?.status && filters.status !== 'all') {
    params.append('status[]', filters.status);
  }
  return params;
}

export const mangadexAdapter: ComicExtensionAdapter = {
  manifest: mangadexManifest,

  async getPopular(page = 1, filters?: SearchFilters) {
    const params = buildFilterParams(page, filters);
    params.set('order[latestUploadedChapter]', 'desc');
    return fetchMangaList(params);
  },

  async getLatest(page = 1) {
    const params = buildFilterParams(page);
    params.set('order[latestUploadedChapter]', 'desc');
    return fetchMangaList(params);
  },

  async search(query: string, filters?: SearchFilters) {
    const params = buildFilterParams(filters?.page || 1, filters);
    if (query.trim().length >= 4) {
      params.append('contentRating[]', 'erotica');
    }
    if (query.trim()) {
      params.set('title', query.trim());
    }
    params.set('order[relevance]', 'desc');
    return fetchMangaList(params);
  },

  async getDetail(comicUrlOrId: string): Promise<ComicDetail> {
    const id = comicUrlOrId.includes('mangadex.org/title/')
      ? comicUrlOrId.split('/title/')[1]?.split('/')[0] || comicUrlOrId
      : comicUrlOrId;

    const cacheKey = `md:detail:v2:${id}`;
    const cached = scraperCache.get<ComicDetail>(cacheKey);
    if (cached) return cached;

    const [mangaRes, feedRes] = await Promise.all([
      fetch(`${API_BASE}/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`, {
        headers: { 'User-Agent': 'ComixCia/1.0' },
      }),
      fetch(
        `${API_BASE}/manga/${id}/feed?limit=500&translatedLanguage[]=id&includeExternalUrl=0&order[chapter]=desc&includes[]=scanlation_group`,
        { headers: { 'User-Agent': 'ComixCia/1.0' } }
      ),
    ]);

    if (!mangaRes.ok) throw new Error(`MangaDex detail ${mangaRes.status}`);
    const mangaJson = (await mangaRes.json()) as { data: MangaDexManga };
    const summary = mapMangaToSummary(mangaJson.data);
    const artistRel = mangaJson.data.relationships.find((r) => r.type === 'artist');

    const feedJson = feedRes.ok
      ? ((await feedRes.json()) as {
          total?: number;
          data?: Array<{
            id: string;
            attributes: {
              chapter?: string | null;
              title?: string | null;
              translatedLanguage?: string;
              publishAt?: string;
              pages?: number;
              externalUrl?: string | null;
            };
            relationships: Array<{ type: string; attributes?: { name?: string } }>;
          }>;
        })
      : { total: 0, data: [] };

    const allFeedItems = [...(feedJson.data || [])];
    const totalChapters = feedJson.total || allFeedItems.length;
    if (totalChapters > 500) {
      const extraOffsets: number[] = [];
      for (let off = 500; off < Math.min(totalChapters, 2500); off += 500) {
        extraOffsets.push(off);
      }
      const extraPages = await Promise.all(
        extraOffsets.map((off) =>
          fetch(
            `${API_BASE}/manga/${id}/feed?limit=500&offset=${off}&translatedLanguage[]=id&includeExternalUrl=0&order[chapter]=desc&includes[]=scanlation_group`,
            { headers: { 'User-Agent': 'ComixCia/1.0' } }
          )
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      );
      for (const page of extraPages) {
        const rows = (page as { data?: typeof allFeedItems } | null)?.data;
        if (rows) allFeedItems.push(...rows);
      }
    }

    const chapters: ChapterSummary[] = allFeedItems
      .filter((ch) => !ch.attributes.externalUrl && (ch.attributes.pages ?? 1) > 0)
      .map((ch) => {
        const group = ch.relationships.find((r) => r.type === 'scanlation_group')?.attributes?.name;
        const chNum = ch.attributes.chapter ? `Ch. ${ch.attributes.chapter}` : 'Oneshot';
        const titleSuffix = ch.attributes.title ? ` - ${ch.attributes.title}` : '';
        return {
          id: ch.id,
          title: `${chNum}${titleSuffix}`,
          number: ch.attributes.chapter || undefined,
          url: ch.id,
          uploadedAt: ch.attributes.publishAt?.slice(0, 10),
          scanlator: group || 'ID',
        };
      });

    const rawDesc =
      mangaJson.data.attributes.description?.id ||
      mangaJson.data.attributes.description?.en ||
      Object.values(mangaJson.data.attributes.description || {})[0];

    const detail: ComicDetail = {
      ...summary,
      artist: artistRel?.attributes?.name,
      synopsis: cleanSynopsis(rawDesc),
      altTitles: mangaJson.data.attributes.altTitles?.map((t) => Object.values(t)[0]).filter(Boolean),
      chapters,
    };

    scraperCache.set(cacheKey, detail, 15 * 60 * 1000);
    return detail;
  },

  async getChapterPages(chapterUrlOrId: string): Promise<ChapterPages> {
    const chapterId = chapterUrlOrId.includes('mangadex.org/chapter/')
      ? chapterUrlOrId.split('/chapter/')[1]?.split('/')[0] || chapterUrlOrId
      : chapterUrlOrId;

    const cacheKey = `md:pages:v2:${chapterId}`;
    const cached = scraperCache.get<ChapterPages>(cacheKey);
    if (cached) return cached;

    const [atHomeRes, metaRes] = await Promise.all([
      fetch(`${API_BASE}/at-home/server/${chapterId}`, {
        headers: { 'User-Agent': 'ComixCia/1.0' },
      }),
      fetch(`${API_BASE}/chapter/${chapterId}?includes[]=manga`, {
        headers: { 'User-Agent': 'ComixCia/1.0' },
      }),
    ]);

    if (!atHomeRes.ok) throw new Error(`MangaDex at-home ${atHomeRes.status}`);
    const atHome = (await atHomeRes.json()) as {
      baseUrl: string;
      chapter: { hash: string; data: string[]; dataSaver: string[] };
    };

    const meta = metaRes.ok
      ? ((await metaRes.json()) as {
          data?: {
            attributes?: { chapter?: string; title?: string };
            relationships?: Array<{
              type: string;
              attributes?: { title?: Record<string, string>; altTitles?: Array<Record<string, string>> };
            }>;
          };
        })
      : {};

    const mangaRel = meta.data?.relationships?.find((r) => r.type === 'manga');
    const comicTitle = pickTitle(mangaRel?.attributes?.title, mangaRel?.attributes?.altTitles);
    const chNum = meta.data?.attributes?.chapter ? `Chapter ${meta.data.attributes.chapter}` : 'Chapter';
    const chTitle = meta.data?.attributes?.title ? `${chNum} - ${meta.data.attributes.title}` : chNum;

    const files = atHome.chapter.dataSaver.length > 0 ? atHome.chapter.dataSaver : atHome.chapter.data;
    const qualityPath = atHome.chapter.dataSaver.length > 0 ? 'data-saver' : 'data';
    const pages = files.map((file) => `${atHome.baseUrl}/${qualityPath}/${atHome.chapter.hash}/${file}`);

    const result: ChapterPages = {
      chapterId,
      sourceId: mangadexManifest.id,
      comicTitle,
      chapterTitle: chTitle,
      pages,
      referer: 'https://mangadex.org/',
    };

    scraperCache.set(cacheKey, result, 30 * 60 * 1000);
    return result;
  },
};
