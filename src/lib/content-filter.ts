import type { ComicSummary } from '@/lib/types';

// Explicit 18++ keywords (hidden by default unless exact/near-exact search match)
const EXPLICIT_18_KEYWORDS = [
  'hentai',
  'smut',
  'pornographic',
  'erotica',
  'doujinshi',
  'r-18',
  'nc-17',
  '18+',
  'nsfw',
  'adult only',
];

// Suggestive / low-ecchi / adult-leaning genres whose covers should be blurred by default
const ADULT_COVER_KEYWORDS = [
  ...EXPLICIT_18_KEYWORDS,
  'ecchi',
  'mature',
  'adult',
  'suggestive',
  'sexual violence',
];

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isExplicit18Plus(comic: ComicSummary): boolean {
  if (comic.contentRating === 'erotica' || comic.contentRating === 'pornographic') {
    return true;
  }
  const genresText = (comic.genres || []).join(' ').toLowerCase();
  const titleText = comic.title.toLowerCase();
  return EXPLICIT_18_KEYWORDS.some(
    (kw) => genresText.includes(kw) || titleText.includes(kw)
  );
}

export function isAdultCover(comic: ComicSummary): boolean {
  if (
    comic.contentRating === 'suggestive' ||
    comic.contentRating === 'erotica' ||
    comic.contentRating === 'pornographic'
  ) {
    return true;
  }
  const genresText = (comic.genres || []).join(' ').toLowerCase();
  const titleText = comic.title.toLowerCase();
  return ADULT_COVER_KEYWORDS.some(
    (kw) => genresText.includes(kw) || titleText.includes(kw)
  );
}

/**
 * Checks if the user's search query is literally/nearly identical to the comic title.
 * Used to allow explicit 18+ titles ONLY when the user explicitly searches for that exact title.
 */
export function isExactTitleMatch(query: string, title: string): boolean {
  const q = normalizeText(query);
  const t = normalizeText(title);
  if (!q || q.length < 4 || !t) return false;
  if (q === t) return true;
  if (t.includes(q) && q.length / t.length >= 0.78) return true;
  if (q.includes(t) && t.length / q.length >= 0.78) return true;
  return false;
}
