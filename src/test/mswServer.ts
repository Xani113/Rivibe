import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const defaultHandlers = [
  http.get('https://itunes.apple.com/search', ({ request }) => {
    const url = new URL(request.url);
    const term = url.searchParams.get('term') ?? 'chill';
    return HttpResponse.json({
      resultCount: 2,
      results: [
        {
          trackId: 1001,
          trackName: `${term} Horizon`,
          artistName: 'Troye Sivan',
          collectionName: 'Blue Neighbourhood',
          artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/100x100bb.jpg',
          previewUrl: 'https://audio-ssl.itunes.apple.com/sample-1.m4a',
          trackTimeMillis: 215000,
          primaryGenreName: 'Synth-Pop',
          releaseDate: '2015-12-04T08:00:00Z',
          trackViewUrl: 'https://music.apple.com/track/1001',
        },
        {
          trackId: 1002,
          trackName: 'Midnight Echoes',
          artistName: 'Porter Robinson',
          collectionName: 'Nurture',
          artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/100x100bb.jpg',
          previewUrl: 'https://audio-ssl.itunes.apple.com/sample-2.m4a',
          trackTimeMillis: 242000,
          primaryGenreName: 'Electronic',
          releaseDate: '2021-04-23T08:00:00Z',
          trackViewUrl: 'https://music.apple.com/track/1002',
        },
      ],
    });
  }),

  http.get('https://discoveryprovider.audius.co/v1/tracks/trending', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'aud-901',
          title: 'Warm Analog Drift',
          user: { name: 'Klangwerk' },
          genre: 'Electronic',
          mood: 'Chill',
          duration: 198,
          play_count: 42000,
          artwork: { '480x480': 'https://audius.example/art-480.jpg' },
        },
      ],
    });
  }),

  http.get('https://discoveryprovider.audius.co/v1/tracks/search', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'aud-902',
          title: 'Velvet Espresso',
          user: { name: 'Miles Collective' },
          genre: 'Jazz',
          mood: 'Relaxing',
          duration: 210,
          play_count: 15000,
          artwork: { '480x480': 'https://audius.example/art-902.jpg' },
        },
      ],
    });
  }),

  http.get('https://api.lyrics.ovh/v1/:artist/:title', () => {
    return HttpResponse.json({
      lyrics: 'Look at the stars\nLook how they shine for you',
    });
  }),

  http.get('/api/music/resolve-full', () => HttpResponse.json({ resolved: null })),
  http.get('/api/music/search', () => HttpResponse.json({ tracks: [] })),
  http.get('/api/music/recommend', () => HttpResponse.json({ tracks: [] })),
];

export const server = setupServer(...defaultHandlers);
