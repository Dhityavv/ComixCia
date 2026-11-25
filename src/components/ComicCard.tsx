'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Bookmark, BookOpen } from 'lucide-react';
import type { ComicSummary } from '@/lib/types';
import { getProxiedImageUrl } from '@/lib/storage';

interface ComicCardProps {
  comic: ComicSummary;
  inLibrary?: boolean;
  onSelect: (comic: ComicSummary) => void;
  onToggleBookmark?: (comic: ComicSummary) => void;
}

export function ComicCard({ comic, inLibrary, onSelect, onToggleBookmark }: ComicCardProps) {
  const coverSrc = getProxiedImageUrl(comic.coverUrl);
  const shouldReduceMotion = useReducedMotion();
  const [isLandscape, setIsLandscape] = useState(false);

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -3 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col rounded-xl overflow-hidden bg-[#19191f] border border-[#303039] hover:border-[var(--accent)] transition-colors duration-200 shadow-sm"
    >
      <button
        type="button"
        onClick={() => onSelect(comic)}
        aria-label={`Buka ${comic.title} dari ${comic.sourceName || comic.sourceId}`}
        className="flex-1 flex flex-col text-left focus:outline-none"
      >
        <div className="relative w-full aspect-[3/4] overflow-hidden bg-[#22222a] flex items-center justify-center">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc}
              alt={comic.title}
              loading="lazy"
              decoding="async"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > img.naturalHeight * 1.12) {
                  setIsLandscape(true);
                }
              }}
              className={`transition-transform duration-200 ${
                isLandscape
                  ? 'max-h-full max-w-full w-full h-auto object-contain'
                  : 'h-full w-full object-cover group-hover:scale-[1.03]'
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#a3a3aa]/40">
              <BookOpen className="h-7 w-7" aria-hidden="true" />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#111114]/90 to-transparent pointer-events-none" />

          {comic.type !== 'unknown' && (
            <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#111114]/85 border border-[#303039] text-[10px] font-semibold uppercase tracking-wide text-[#f5f4f2]">
              {comic.type}
            </span>
          )}

          {comic.latestChapter && (
            <span className="absolute bottom-2 left-2.5 px-2 py-0.5 rounded-md bg-[#111114]/85 border border-[#303039] text-[10px] font-medium text-[#f5f4f2] tabular-nums max-w-[85%] truncate">
              {comic.latestChapter}
            </span>
          )}
        </div>

        <div className="p-3 flex-1 flex flex-col justify-between gap-1.5 w-full">
          <h3 className="font-heading line-clamp-2 text-[13px] font-semibold text-[#f5f4f2] group-hover:text-[var(--accent)] transition-colors leading-snug">
            {comic.title}
          </h3>
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#a3a3aa]">
            <span className="truncate">{comic.sourceName || comic.sourceId}</span>
            {comic.status && comic.status !== 'unknown' && (
              <span className="shrink-0 capitalize text-[10px] text-[#a3a3aa]">
                {comic.status === 'ongoing' ? 'Berlanjut' : comic.status === 'completed' ? 'Tamat' : comic.status}
              </span>
            )}
          </div>
        </div>
      </button>

      {onToggleBookmark && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark(comic);
          }}
          aria-label={inLibrary ? `Hapus ${comic.title} dari Koleksi` : `Simpan ${comic.title} ke Koleksi`}
          className={`absolute top-2.5 right-2.5 rounded-lg p-1.5 border transition-all duration-200 ${
            inLibrary
              ? 'bg-[var(--accent)] border-[var(--accent)] text-[#111114] opacity-100'
              : 'bg-[#111114]/80 border-[#303039] text-[#f5f4f2] opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
        >
          <Bookmark className={`h-3.5 w-3.5 ${inLibrary ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>
      )}
    </motion.div>
  );
}
