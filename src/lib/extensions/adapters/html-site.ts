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
  normalizeComicStatus,
  normalizeComicType,
} from '@/lib/extensions/types';
import { fetchHtmlDirect, loadHtml, resolveUrl } from '@/lib/scraper/http-client';

export interface SiteScrapingProfile {
  manifest: ExtensionManifest;
  popularPath: string;
  latestPath: string;
  searchPath: (query: string, page: number) => string;
  itemSelectors: string[];
  titleSelectors: string[];
  linkSelectors: string[];
  coverSelectors: string[];
  typeSelectors: string[];
  latestChapterSelectors: string[];
  detailTitleSelectors: string[];
  detailCoverSelectors: string[];
  detailSynopsisSelectors: string[];
  detailGenreSelectors: string[];
  detailStatusSelectors: string[];
  detailTypeSelectors: string[];
  chapterListSelectors: string[];
  pageImageSelectors: string[];
}

function firstText($root: ReturnType<ReturnType<typeof loadHtml>>, selectors: string[]): string {
  for (const sel of selectors) {
    const txt = $root.find(sel).first().text().trim();
    if (txt) return txt;
  }
  return '';
}

function firstAttr(
  $root: ReturnType<ReturnType<typeof loadHtml>>,
  selectors: string[],
  attr: string
): string {
  for (const sel of selectors) {
    const val = $root.find(sel).first().attr(attr)?.trim();
    if (val) return val;
  }
  return '';
}

function parseListPage(
  html: string,
  baseUrl: string,
  profile: SiteScrapingProfile
): ComicSummary[] {
  const $ = loadHtml(html);
  const results: ComicSummary[] = [];
  const seen = new Set<string>();

  let $items = $(profile.itemSelectors[0]);
  for (const sel of profile.itemSelectors) {
    const found = $(sel);
    if (found.length > 0) {
      $items = found;
      break;
    }
  }

  $items.each((_, el) => {
    const $el = $(el);
    const rawHref =
      firstAttr($el, profile.linkSelectors, 'href') || $el.find('a').first().attr('href') || '';
    const url = resolveUrl(baseUrl, rawHref);
    if (!url || seen.has(url)) return;

    const title =
      firstText($el, profile.titleSelectors) ||
      $el.find('a').first().attr('title')?.trim() ||
      $el.find('a').first().text().trim();
    if (!title) return;

    let coverUrl = '';
    for (const sel of profile.coverSelectors) {
      const $img = $el.find(sel).first();
      if ($img.length) {
        coverUrl = extractBestImgSrc($img, baseUrl);
        if (coverUrl) break;
      }
    }
    if (!coverUrl) {
      const $img = $el.find('img').first();
      if ($img.length) coverUrl = extractBestImgSrc($img, baseUrl);
    }

    const typeText = firstText($el, profile.typeSelectors);
    const type =
      normalizeComicType(typeText) !== 'unknown'
        ? normalizeComicType(typeText)
        : profile.manifest.types[0] || 'unknown';

    const latestChapter = firstText($el, profile.latestChapterSelectors) || undefined;

    seen.add(url);
    results.push({
      id: encodeURIComponent(url),
      sourceId: profile.manifest.id,
      sourceName: profile.manifest.name,
      title,
      url,
      coverUrl,
      type,
      latestChapter,
      lang: profile.manifest.lang,
    });
  });

  return results;
}

async function enrichKomikuCovers(items: ComicSummary[], baseUrl: string): Promise<ComicSummary[]> {
  return Promise.all(
    items.map(async (item) => {
      try {
        const { html } = await fetchHtmlDirect(item.url, {
          referer: baseUrl,
          ttlMs: 15 * 60 * 1000,
        });
        const $ = loadHtml(html);
        const $ims = $('.ims img, .thumb img').first();
        if ($ims.length) {
          const portrait = extractBestImgSrc($ims, item.url);
          if (portrait) {
            return { ...item, coverUrl: portrait };
          }
        }
      } catch {
        // keep original cover if detail fetch fails
      }
      return item;
    })
  );
}

export function createHtmlSiteAdapter(
  profile: SiteScrapingProfile,
  baseUrlOverride?: string
): ComicExtensionAdapter {
  const activeBaseUrl = (baseUrlOverride?.trim() || profile.manifest.baseUrl).replace(/\/$/, '');
  const manifest: ExtensionManifest = {
    ...profile.manifest,
    baseUrl: activeBaseUrl,
  };

  return {
    manifest,

    async getPopular(page = 1, filters?: SearchFilters): Promise<ExtensionResultList> {
      const targetUrl = resolveUrl(
        activeBaseUrl,
        profile.popularPath.replace('{page}', String(page))
      );
      const { html, engineUsed } = await fetchHtmlDirect(targetUrl, {
        referer: activeBaseUrl,
      });
      let items = filterBySearchFilters(parseListPage(html, activeBaseUrl, profile), filters);
      if (manifest.id === 'komiku') {
        items = await enrichKomikuCovers(items, activeBaseUrl);
      }
      return { items, engineUsed };
    },

    async getLatest(page = 1): Promise<ExtensionResultList> {
      const targetUrl = resolveUrl(
        activeBaseUrl,
        profile.latestPath.replace('{page}', String(page))
      );
      const { html, engineUsed } = await fetchHtmlDirect(targetUrl, {
        referer: activeBaseUrl,
      });
      let items = parseListPage(html, activeBaseUrl, profile);
      if (manifest.id === 'komiku') {
        items = await enrichKomikuCovers(items, activeBaseUrl);
      }
      return { items, engineUsed };
    },

    async search(query: string, filters?: SearchFilters): Promise<ExtensionResultList> {
      const targetUrl = resolveUrl(
        activeBaseUrl,
        profile.searchPath(query, filters?.page || 1)
      );
      const { html, engineUsed } = await fetchHtmlDirect(targetUrl, {
        referer: activeBaseUrl,
      });
      let items = filterBySearchFilters(parseListPage(html, activeBaseUrl, profile), filters);
      if (manifest.id === 'komiku') {
        items = await enrichKomikuCovers(items, activeBaseUrl);
      }
      return { items, engineUsed };
    },

    async getDetail(comicUrlOrId: string): Promise<ComicDetail> {
      const url = comicUrlOrId.startsWith('http')
        ? comicUrlOrId
        : decodeURIComponent(comicUrlOrId);
      const targetUrl = resolveUrl(activeBaseUrl, url);

      const { html } = await fetchHtmlDirect(targetUrl, {
        referer: activeBaseUrl,
        ttlMs: 15 * 60 * 1000,
      });

      const $ = loadHtml(html);
      const $root = $.root();

      const title =
        firstText($root, profile.detailTitleSelectors) ||
        $('h1').first().text().trim() ||
        'Untitled';

      let coverUrl = '';
      for (const sel of profile.detailCoverSelectors) {
        const $img = $(sel).first();
        if ($img.length) {
          coverUrl = extractBestImgSrc($img, targetUrl);
          if (coverUrl) break;
        }
      }

      const synopsis =
        firstText($root, profile.detailSynopsisSelectors) || 'Tidak ada sinopsis.';

      const genres: string[] = [];
      for (const sel of profile.detailGenreSelectors) {
        $(sel).each((_, gEl) => {
          const g = $(gEl).text().trim();
          if (g && !genres.includes(g)) genres.push(g);
        });
        if (genres.length > 0) break;
      }

      const statusText = firstText($root, profile.detailStatusSelectors);
      const typeText = firstText($root, profile.detailTypeSelectors);

      const chapters: ChapterSummary[] = [];
      const seenCh = new Set<string>();

      for (const sel of profile.chapterListSelectors) {
        const $rows = $(sel);
        if ($rows.length === 0) continue;

        $rows.each((_, row) => {
          const $row = $(row);
          const $link = $row.is('a') ? $row : $row.find('a').first();
          const chHref = $link.attr('href');
          if (!chHref) return;
          const chUrl = resolveUrl(targetUrl, chHref);
          if (!chUrl || seenCh.has(chUrl)) return;

          const chTitle =
            $row.find('.chapternum, .chapter-title, .judulseries').first().text().trim() ||
            $link.text().trim() ||
            'Chapter';
          const uploadedAt =
            $row.find('.chapterdate, .chapter-release-date, .date').first().text().trim() ||
            undefined;

          seenCh.add(chUrl);
          chapters.push({
            id: encodeURIComponent(chUrl),
            title: chTitle.replace(/\s+/g, ' ').trim(),
            url: chUrl,
            uploadedAt,
          });
        });

        if (chapters.length > 0) break;
      }

      return {
        id: encodeURIComponent(targetUrl),
        sourceId: manifest.id,
        sourceName: manifest.name,
        title,
        url: targetUrl,
        coverUrl,
        type:
          normalizeComicType(typeText) !== 'unknown'
            ? normalizeComicType(typeText)
            : manifest.types[0] || 'unknown',
        status: normalizeComicStatus(statusText),
        genres,
        synopsis,
        chapters,
        lang: manifest.lang,
      };
    },

    async getChapterPages(chapterUrlOrId: string): Promise<ChapterPages> {
      const rawUrl = chapterUrlOrId.startsWith('http')
        ? chapterUrlOrId
        : decodeURIComponent(chapterUrlOrId);
      const targetUrl = resolveUrl(activeBaseUrl, rawUrl);

      const { html } = await fetchHtmlDirect(targetUrl, {
        referer: activeBaseUrl,
        ttlMs: 30 * 60 * 1000,
      });

      const $ = loadHtml(html);
      const pages: string[] = [];
      const seenPages = new Set<string>();

      for (const sel of profile.pageImageSelectors) {
        $(sel).each((_, imgEl) => {
          const src = extractBestImgSrc($(imgEl), targetUrl);
          if (
            src &&
            !seenPages.has(src) &&
            !src.includes('logo') &&
            !src.includes('avatar') &&
            !src.includes('discord')
          ) {
            seenPages.add(src);
            pages.push(src);
          }
        });
        if (pages.length > 0) break;
      }

      if (pages.length === 0) {
        const tsMatch = html.match(/ts_reader\.run\((\{[\s\S]*?\})\)/);
        if (tsMatch?.[1]) {
          try {
            const parsed = JSON.parse(tsMatch[1]) as {
              sources?: Array<{ images?: string[] }>;
            };
            const imgs = parsed.sources?.[0]?.images || [];
            for (const img of imgs) {
              if (img) pages.push(resolveUrl(targetUrl, img));
            }
          } catch {
            // ignore JSON parse failure
          }
        }
      }

      const nextHref =
        $('a.ch-next-btn, a.next_page, a[rel="next"]').first().attr('href') || null;
      const prevHref =
        $('a.ch-prev-btn, a.prev_page, a[rel="prev"]').first().attr('href') || null;

      return {
        chapterId: encodeURIComponent(targetUrl),
        sourceId: manifest.id,
        comicTitle: $('h1').first().text().trim() || manifest.name,
        chapterTitle: $('h1, .entry-title, #chapter-heading').first().text().trim() || 'Chapter',
        pages,
        nextChapterUrl: nextHref && nextHref !== '#/' ? resolveUrl(targetUrl, nextHref) : null,
        prevChapterUrl: prevHref && prevHref !== '#/' ? resolveUrl(targetUrl, prevHref) : null,
        referer: activeBaseUrl,
      };
    },
  };
}
