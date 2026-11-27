import type { ReactNode } from 'react';

export const metadata = {
  title: 'RiVibe Cloud API',
  description: 'Next.js backend for RiVibe user accounts, cloud playlists, and YouTube/public-apis music catalog',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#120e0b', color: '#fbf7f2', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
