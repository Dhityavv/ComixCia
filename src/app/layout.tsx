import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';
import { SmoothScroll } from '@/components/SmoothScroll';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ComixCia — Platform Baca Komik Editorial',
  description:
    'Platform baca komik Bahasa Indonesia dengan desain editorial adaptif — Manga, Manhwa, Manhua, dan Webtoon.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="id"
      className={`${manrope.variable} ${inter.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-[#111114] text-[#f5f4f2] font-sans flex flex-col">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
