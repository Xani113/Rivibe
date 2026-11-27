export default function BackendHomePage() {
  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 24px', lineHeight: 1.6 }}>
      <h1 style={{ color: '#f0c46c', marginBottom: 8 }}>RiVibe Cloud & Music API</h1>
      <p style={{ color: 'rgba(247,239,230,0.78)' }}>
        Next.js App Router backend serving SQLite-backed user accounts, cloud playlists, taste profile sync,
        and full-song music catalog proxy routes (YouTube Data API v3, Audius, Deezer, Jamendo, Last.fm, TasteDive).
      </p>
      <ul style={{ color: 'rgba(247,239,230,0.84)' }}>
        <li><code>GET /api/health</code> — Server health & configured music API status</li>
        <li><code>POST /api/auth/register</code>, <code>/api/auth/login</code>, <code>/api/auth/logout</code>, <code>GET /api/auth/me</code></li>
        <li><code>GET|PUT /api/library</code> & <code>GET|POST /api/library/playlists</code></li>
        <li><code>GET /api/music/search</code>, <code>/api/music/recommend</code>, <code>/api/music/resolve-full</code></li>
      </ul>
    </main>
  );
}
