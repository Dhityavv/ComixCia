import type {
  ChapterPages,
  ChapterSummary,
  ComicDetail,
  ComicSummary,
  ExtensionManifest,
  SearchFilters,
} from '@/lib/types';
import {
  type ComicExtensionAdapter,
  type ExtensionResultList,
  extractBestImgSrc,
  filterBySearchFilters,
} from '@/lib/extensions/types';
import { fetchHtmlDirect, loadHtml, resolveUrl } from '@/lib/scraper/http-client';

const BASE = 'https://www.webtoons.com';

export const webtoonManifest: ExtensionManifest = {
  id: 'webtoon',
  name: 'LINE Webtoon ID',
  baseUrl: `${BASE}/id`,
  lang: 'id',
  version: '1.0.0',
  description: 'LINE Webtoon Indonesia — Originals & Canvas resmi Bahasa Indonesia',
  types: ['manhwa', 'comic'],
  isPreinstalled: true,
  scraperEngine: 'direct-html',
  accentColor: '#00DC64',
};

function parseWebtoonCards(html: string): ComicSummary[] {
  const $ = loadHtml(html);
  const items: ComicSummary[] = [];
  const seen = new Set<string>();

  $('a[href*="title_no="]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    const url = resolveUrl(BASE, href);
    if (!url || !url.includes('/list?') || seen.has(url)) return;

    const title =
      $a.find('.subj, .title, strong, p.subj').first().text().trim() ||
      $a.attr('title')?.trim() ||
      $a.text().replace(/\s+/g, ' ').trim();
    if (!title || title.length < 2) return;

    const $img = $a.find('img').first();
    const coverUrl = $img.length ? extractBestImgSrc($img, BASE) : '';
    const genre = $a.find('.genre').first().text().trim();

    seen.add(url);
    items.push({
      id: encodeURIComponent(url),
      sourceId: webtoonManifest.id,
      sourceName: webtoonManifest.name,
      title,
      url,
      coverUrl,
      type: 'manhwa',
      genres: genre ? [genre] : [],
      lang: 'id',
    });
  });

  return items;
}

export const webtoonAdapter: ComicExtensionAdapter = {
  manifest: webtoonManifest,

  async getPopular(page = 1, filters?: SearchFilters): Promise<ExtensionResultList> {
    void page;
    const url = `${BASE}/id/originals`;
    const { html, engineUsed } = await fetchHtmlDirect(url, { referer: BASE });
    const items = filterBySearchFilters(parseWebtoonCards(html), filters);
    return { items, engineUsed };
  },

  async getLatest(): Promise<ExtensionResultList> {
    const url = `${BASE}/id/originals?sortOrder=UPDATE`;
    const { html, engineUsed } = await fetchHtmlDirect(url, { referer: BASE });
    return { items: parseWebtoonCards(html), engineUsed };
  },

  async search(query: string, filters?: SearchFilters): Promise<ExtensionResultList> {
    const url = `${BASE}/id/search?keyword=${encodeURIComponent(query.trim())}`;
    const { html, engineUsed } = await fetchHtmlDirect(url, { referer: BASE });
    const items = filterBySearchFilters(parseWebtoonCards(html), filters);
    return { items, engineUsed };
  },

  async getDetail(comicUrlOrId: string): Promise<ComicDetail> {
    const rawUrl = comicUrlOrId.startsWith('http')
      ? comicUrlOrId
      : decodeURIComponent(comicUrlOrId);
    const targetUrl = resolveUrl(BASE, rawUrl);
    const titleNo = new URL(targetUrl).searchParams.get('title_no');

    const [detailRes, epApiRes] = await Promise.all([
      fetchHtmlDirect(targetUrl, { referer: BASE, ttlMs: 15 * 60 * 1000 }),
      titleNo
        ? fetch(`https://m.webtoons.com/api/v1/webtoon/${titleNo}/episodes?pageSize=2000`, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              Referer: 'https://m.webtoons.com/',
            },
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    const $ = loadHtml(detailRes.html);
    const title = $('h1.subj, .info h1').first().text().trim() || 'Webtoon';
    const genre = $('.info .genre').first().text().trim();
    const author = $('.info .author').first().text().replace(/\s+/g, ' ').trim();
    const synopsis =
      $('p.summary').first().text().trim() || 'Tidak ada sinopsis.';
    const coverUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('.detail_body .thmb img, .detail_header .thmb img').first().attr('src') ||
      '';

    const chapters: ChapterSummary[] = [];

    const apiList = (
      epApiRes as {
        result?: {
          episodeList?: Array<{
            episodeNo: number;
            episodeTitle: string;
            viewerLink: string;
            exposureDateMillis?: number;
          }>;
        };
      } | null
    )?.result?.episodeList;

    if (apiList && apiList.length > 0) {
      // Reverse so newest episode is first (consistent with Komiku & MangaDex)
      for (const ep of [...apiList].reverse()) {
        const epUrl = resolveUrl(BASE, ep.viewerLink);
        chapters.push({
          id: encodeURIComponent(epUrl),
          title: ep.episodeTitle || `Episode ${ep.episodeNo}`,
          number: String(ep.episodeNo),
          url: epUrl,
          uploadedAt: ep.exposureDateMillis
            ? new Date(ep.exposureDateMillis).toISOString().slice(0, 10)
            : undefined,
        });
      }
    } else {
      $('#_listUl li a').each((_, el) => {
        const $a = $(el);
        const href = $a.attr('href');
        if (!href) return;
        const epUrl = resolveUrl(BASE, href);
        const epTitle =
          $a.find('.subj span').first().text().trim() ||
          $a.find('.subj').first().text().trim() ||
          'Episode';
        const uploadedAt = $a.find('.date').first().text().trim() || undefined;
        chapters.push({
          id: encodeURIComponent(epUrl),
          title: epTitle,
          url: epUrl,
          uploadedAt,
        });
      });
    }

    return {
      id: encodeURIComponent(targetUrl),
      sourceId: webtoonManifest.id,
      sourceName: webtoonManifest.name,
      title,
      url: targetUrl,
      coverUrl,
      type: 'manhwa',
      status: 'ongoing',
      genres: genre ? [genre] : [],
      author: author || undefined,
      synopsis,
      chapters,
      lang: 'id',
    };
  },

  async getChapterPages(chapterUrlOrId: string): Promise<ChapterPages> {
    const rawUrl = chapterUrlOrId.startsWith('http')
      ? chapterUrlOrId
      : decodeURIComponent(chapterUrlOrId);
    const targetUrl = resolveUrl(BASE, rawUrl);

    const { html } = await fetchHtmlDirect(targetUrl, {
      referer: `${BASE}/`,
      ttlMs: 30 * 60 * 1000,
    });

    const $ = loadHtml(html);
    const pages: string[] = [];
    $('#_imageList img._images').each((_, el) => {
      const src = $(el).attr('data-url') || $(el).attr('src') || '';
      if (src && !pages.includes(src)) {
        pages.push(resolveUrl(targetUrl, src));
      }
    });

    return {
      chapterId: encodeURIComponent(targetUrl),
      sourceId: webtoonManifest.id,
      comicTitle: $('a.subj_info').first().text().trim() || webtoonManifest.name,
      chapterTitle: $('h1.subj_episode').first().text().trim() || 'Episode',
      pages,
      referer: `${BASE}/`,
    };
  },
};
