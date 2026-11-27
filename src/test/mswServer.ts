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

  http.get('https://de1.api.radio-browser.info/json/stations/topvote/:limit', () => {
    return HttpResponse.json([
      {
        stationuuid: 'rad-1',
        name: 'Groove Salad Classic',
        url_resolved: 'https://ice1.somafm.com/groovesalad-128-mp3',
        favicon: 'https://somafm.com/img/groovesalad120.png',
        country: 'United States',
        tags: 'ambient,chill,electronic',
        bitrate: 128,
        votes: 9800,
      },
    ]);
  }),

  http.get('https://de1.api.radio-browser.info/json/stations/search', () => {
    return HttpResponse.json([
      {
        stationuuid: 'rad-2',
        name: 'Jazz24',
        url_resolved: 'https://live.wostreaming.net/direct/ppm-jazz24aac-ibc1',
        favicon: '',
        country: 'United States',
        tags: 'jazz,bebop,instrumental',
        bitrate: 128,
        votes: 7500,
      },
    ]);
  }),

  http.get('https://api.lyrics.ovh/v1/:artist/:title', () => {
    return HttpResponse.json({
      lyrics: 'Look at the stars\nLook how they shine for you',
    });
  }),

  http.get('https://www.theaudiodb.com/api/v1/json/:key/search.php', () => {
    return HttpResponse.json({
      artists: [
        {
          strArtist: 'Troye Sivan',
          strGenre: 'Synth-Pop',
          strMood: 'Dreamy',
          strStyle: 'Electropop',
          strBiographyEN: 'Australian singer-songwriter known for atmospheric synth-pop.',
          strArtistBanner: 'https://audiodb.example/banner.jpg',
          strArtistThumb: 'https://audiodb.example/thumb.jpg',
          intFormedYear: '2007',
          strCountry: 'Australia',
        },
      ],
    });
  }),

  http.get('https://api.listenbrainz.org/1/explore/fresh-releases/', () => {
    return HttpResponse.json({
      payload: {
        releases: [
          {
            release_name: 'Afterlight Sessions',
            artist_credit_name: 'Soo Jin',
            release_date: '2026-11-15',
            release_mbid: 'mbid-1',
          },
        ],
      },
    });
  }),

  http.get('https://binaryjazz.us/wp-json/genrenator/v1/genre/', () => {
    return HttpResponse.json('dreamy lo-fi synthwave');
  }),

  http.get('/api/health', () => {
    return HttpResponse.json({
      ok: true,
      service: 'rivibe-nextjs-backend',
      capabilities: {
        youtubeFullSongs: false,
        lastfm: false,
        tastedive: false,
        jamendo: false,
        audius: true,
        deezerProxy: true,
        itunes: true,
      },
    });
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json({ user: null });
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as { email: string; displayName: string };
    return HttpResponse.json(
      {
        user: {
          id: 'usr-cloud-1',
          email: body.email,
          displayName: body.displayName,
          createdAt: Date.now(),
        },
        token: 'mock-jwt-token',
      },
      { status: 201 },
    );
  }),

  http.put('/api/library', () => HttpResponse.json({ ok: true })),
  http.get('/api/library', () => HttpResponse.json({ snapshot: null, playlists: [] })),
  http.get('/api/music/resolve-full', () => HttpResponse.json({ resolved: null })),
  http.get('/api/music/search', () => HttpResponse.json({ tracks: [] })),
  http.get('/api/music/recommend', () => HttpResponse.json({ tracks: [] })),
];

export const server = setupServer(...defaultHandlers);
