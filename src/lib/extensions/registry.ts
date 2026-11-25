import type { ExtensionManifest } from '@/lib/types';
import type { ComicExtensionAdapter } from '@/lib/extensions/types';
import { mangadexAdapter } from '@/lib/extensions/adapters/mangadex';
import { webtoonAdapter } from '@/lib/extensions/adapters/webtoon';
import {
  createHtmlSiteAdapter,
  type SiteScrapingProfile,
} from '@/lib/extensions/adapters/html-site';
import { createCustomCssAdapter } from '@/lib/extensions/adapters/custom-css';

const MADARA_STREAM_LIST = {
  itemSelectors: ['.bs', '.page-item-manga', '.utao', '.animepost', '.listupd .bsx', 'article'],
  titleSelectors: ['.tt', '.post-title h3 a', '.post-title h5 a', 'h4', 'h3', '.title'],
  linkSelectors: ['a[href*="/series/"]', 'a[href*="/manga/"]', 'a[href*="/komik/"]', 'a'],
  coverSelectors: ['img.wp-post-image', '.limit img', '.img-responsive', 'img'],
  typeSelectors: ['.type', '.typeflag', '.manga-type'],
  latestChapterSelectors: ['.epxs', '.chapter a', '.latest-chap', '.lsch'],
  detailTitleSelectors: ['h1.entry-title', '.post-title h1', '.seriestucon h1', 'h1'],
  detailCoverSelectors: ['.thumb img', '.summary_image img', '.seriestucont img', 'img.wp-post-image'],
  detailSynopsisSelectors: ['.entry-content[itemprop="description"]', '.summary__content', '.sinopsis', '.desc'],
  detailGenreSelectors: ['.mgen a', '.seriestugenre a', '.genres-content a', '.genre a'],
  detailStatusSelectors: ['.tsinfo .imptdt:contains("Status") i', '.post-status .summary-content', '.infotable tr:contains("Status") td'],
  detailTypeSelectors: ['.tsinfo .imptdt:contains("Type") a', '.post-content_item:contains("Type") .summary-content', '.infotable tr:contains("Type") td'],
  chapterListSelectors: ['#chapterlist li', 'ul.main li.wp-manga-chapter', '.eplister ul li', '.chapter-list li'],
  pageImageSelectors: ['#readerarea img', '.reading-content img', '.chapter-content img', '.main-reading-area img'],
};

const SITE_PROFILES: Record<string, SiteScrapingProfile> = {
  komiku: {
    manifest: {
      id: 'komiku',
      name: 'Komiku',
      baseUrl: 'https://komiku.org',
      lang: 'id',
      version: '1.5.0',
      description: 'Komiku.org — Baca Manga, Manhwa & Manhua Bahasa Indonesia',
      types: ['manga', 'manhwa', 'manhua'],
      isPreinstalled: true,
      scraperEngine: 'direct-html',
      accentColor: '#10B981',
    },
    popularPath: 'https://api.komiku.org/manga/?orderby=meta_value_num',
    latestPath: 'https://api.komiku.org/manga/',
    searchPath: (q) => `https://api.komiku.org/?post_type=manga&s=${encodeURIComponent(q)}`,
    itemSelectors: ['.bge', '.daftar', '.ls4', '.bs'],
    titleSelectors: ['.kan h3', 'h3', 'h4', '.tt'],
    linkSelectors: ['.kan a', '.bgei a', 'a'],
    coverSelectors: ['.bgei img', 'img'],
    typeSelectors: ['.tpe1_inf b', '.type'],
    latestChapterSelectors: ['.new1 a', '.epxs'],
    detailTitleSelectors: ['#Judul h1', 'h1'],
    detailCoverSelectors: ['.ims img', '.thumb img'],
    detailSynopsisSelectors: ['.desc', 'p[itemprop="description"]', '.sin'],
    detailGenreSelectors: ['.genre li a', '.mgen a'],
    detailStatusSelectors: ['.inftable tr:contains("Status") td:last-child'],
    detailTypeSelectors: ['.inftable tr:contains("Jenis") td:last-child'],
    chapterListSelectors: ['#Daftar_Chapter tbody tr', '#chapterlist li'],
    pageImageSelectors: ['#Baca_Komik img', '#readerarea img'],
  },
  kiryuu: {
    manifest: {
      id: 'kiryuu',
      name: 'Kiryuu',
      baseUrl: 'https://v7.kiryuu.to',
      lang: 'id',
      version: '1.4.0',
      description: 'Kiryuu (v7.kiryuu.to) — Manga, Manhwa & Manhua Sub Indo',
      types: ['manga', 'manhwa', 'manhua'],
      isPreinstalled: true,
      scraperEngine: 'direct-html',
      accentColor: '#8B5CF6',
    },
    popularPath: '/manga/?order=popular',
    latestPath: '/manga/?order=update',
    searchPath: (q, p) => `/page/${p}/?s=${encodeURIComponent(q)}`,
    itemSelectors: ['.grid > div', '.bs'],
    titleSelectors: ['h1', 'h2', 'h3', 'a[href*="/manga/"]'],
    linkSelectors: ['a[href*="/manga/"]', 'a'],
    coverSelectors: ['img'],
    typeSelectors: ['.type', 'span'],
    latestChapterSelectors: ['a[href*="chapter-"]', '.epxs'],
    detailTitleSelectors: ['h1', '.entry-title'],
    detailCoverSelectors: ['img.wp-post-image', 'main img', 'img'],
    detailSynopsisSelectors: ['.entry-content', 'p'],
    detailGenreSelectors: ['a[href*="/genres/"]', 'a[href*="/genre/"]'],
    detailStatusSelectors: ['span:contains("Ongoing")', 'span:contains("Completed")'],
    detailTypeSelectors: ['a[href*="/type/"]', 'span'],
    chapterListSelectors: ['a[href*="chapter-"]', '#chapterlist li'],
    pageImageSelectors: ['section img', '#readerarea img', 'main img'],
  },
  luvyaa: {
    manifest: {
      id: 'luvyaa',
      name: 'Luvyaa',
      baseUrl: 'https://v6.luvyaa.co',
      lang: 'id',
      version: '1.2.0',
      description: 'Luvyaa (v6.luvyaa.co) — Koleksi Manhwa & Manga Sub Indo',
      types: ['manhwa', 'manga'],
      isPreinstalled: true,
      scraperEngine: 'direct-html',
      accentColor: '#EC4899',
    },
    popularPath: '/manga/?order=popular',
    latestPath: '/manga/?order=update',
    searchPath: (q, p) => `/page/${p}/?s=${encodeURIComponent(q)}`,
    ...MADARA_STREAM_LIST,
  },
  maid: {
    manifest: {
      id: 'maid',
      name: 'Maid.my.id',
      baseUrl: 'https://www.maid.my.id',
      lang: 'id',
      version: '1.2.0',
      description: 'Maid.my.id — Manga & Adaptasi Novel Sub Indo',
      types: ['manga', 'manhwa'],
      isPreinstalled: true,
      scraperEngine: 'direct-html',
      accentColor: '#14B8A6',
    },
    popularPath: '/',
    latestPath: '/',
    searchPath: (q) => `/?s=${encodeURIComponent(q)}`,
    itemSelectors: ['.flexbox3-item', '.flexbox2-item'],
    titleSelectors: ['.title', '.flexbox3-title', 'h4', 'a[title]'],
    linkSelectors: ['a[href*="/manga/"]', 'a'],
    coverSelectors: ['img'],
    typeSelectors: ['.type'],
    latestChapterSelectors: ['.chapter', '.lsch'],
    detailTitleSelectors: ['.series-title h2', 'h1'],
    detailCoverSelectors: ['.series-thumb img', 'img'],
    detailSynopsisSelectors: ['.series-synops', 'p'],
    detailGenreSelectors: ['.series-genres a', '.genre a'],
    detailStatusSelectors: ['.status'],
    detailTypeSelectors: ['.type'],
    chapterListSelectors: ['.series-chapterlist a', '#chapterlist li'],
    pageImageSelectors: ['.reader-area img', '#readerarea img'],
  },
};

const REST_ADAPTERS: Record<string, ComicExtensionAdapter> = {
  mangadex: mangadexAdapter,
  webtoon: webtoonAdapter,
};

export function getAllBuiltinManifests(): ExtensionManifest[] {
  return [
    ...Object.values(REST_ADAPTERS).map((a) => a.manifest),
    ...Object.values(SITE_PROFILES).map((p) => p.manifest),
  ];
}

export function resolveAdapter(
  sourceId: string,
  customManifest?: ExtensionManifest,
  baseUrlOverride?: string
): ComicExtensionAdapter {
  if (REST_ADAPTERS[sourceId]) {
    return REST_ADAPTERS[sourceId];
  }
  if (SITE_PROFILES[sourceId]) {
    return createHtmlSiteAdapter(SITE_PROFILES[sourceId], baseUrlOverride);
  }
  if (customManifest && customManifest.customConfig) {
    return createCustomCssAdapter(customManifest, baseUrlOverride);
  }
  throw new Error(`Extension "${sourceId}" tidak ditemukan atau belum terpasang.`);
}
