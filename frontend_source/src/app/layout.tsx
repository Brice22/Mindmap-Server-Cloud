import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HServer | Family Mindmap',
  description: 'Better than Obsidian - 1.8TB SSD Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-900 text-slate-100 min-h-screen">
        {/* This is where your page.tsx content will be injected */}
        {children}
      </body>
    </html>
  );
}
