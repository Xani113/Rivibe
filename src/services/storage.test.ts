import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadTasteProfile,
  saveTasteProfile,
  loadApiVault,
  saveApiVault,
  loadPlaylists,
  savePlaylists,
  resetVaultSecrets,
  loadSavedQueue,
  saveQueueState,
  loadRecentSearches,
  saveRecentSearches,
  STORAGE_VERSION,
} from './storage';
import { SEED_TRACKS } from './seedCatalog';

describe('storage service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a valid default TasteProfile when storage is empty', () => {
    const profile = loadTasteProfile();
    expect(profile.version).toBe(STORAGE_VERSION);
    expect(profile.displayName).toBe('Listener');
    expect(profile.likedTrackIds).toEqual([]);
    expect(Object.keys(profile.genreWeights)).toEqual([]);
  });

  it('persists and reloads TasteProfile changes', () => {
    const profile = loadTasteProfile();
    profile.displayName = 'Aarav';
    profile.genreWeights['Jazz'] = 5;
    saveTasteProfile(profile);

    const reloaded = loadTasteProfile();
    expect(reloaded.displayName).toBe('Aarav');
    expect(reloaded.genreWeights['Jazz']).toBe(5);
  });

  it('recovers gracefully from malformed JSON in localStorage', () => {
    localStorage.setItem('rivibe_taste_profile_v1', '{not valid json');
    const profile = loadTasteProfile();
    expect(profile.version).toBe(STORAGE_VERSION);
    expect(profile.displayName).toBe('Listener');
  });

  it('saves and loads API Vault keys and clears them on reset', () => {
    const vault = loadApiVault();
    expect(vault.githubRepoUrl).toBeTruthy();

    saveApiVault({
      ...vault,
      youtubeApiKey: 'test-yt-key',
      backendUrl: 'https://api.example.com',
    });

    const loaded = loadApiVault();
    expect(loaded.youtubeApiKey).toBe('test-yt-key');
    expect(loaded.backendUrl).toBe('https://api.example.com');

    const cleared = resetVaultSecrets();
    expect(cleared.youtubeApiKey).toBe('');
    expect(cleared.backendUrl).toBe('');
  });

  it('loads default playlists and persists newly created playlists', () => {
    const initial = loadPlaylists();
    expect(initial.some((p) => p.name === 'Liked Songs')).toBe(true);

    const updated = [
      ...initial,
      {
        id: 'pl-custom',
        name: 'Roadtrip Glass',
        description: 'Evening highway tracks',
        coverUrl: '',
        trackIds: ['seed-blue-neighbourhood'],
        createdAt: 1700000099000,
      },
    ];
    savePlaylists(updated);

    expect(loadPlaylists().some((p) => p.id === 'pl-custom')).toBe(true);
  });

  it('persists playback queue and recent searches', () => {
    saveQueueState(SEED_TRACKS.slice(0, 3), 1);
    const loadedQueue = loadSavedQueue();
    expect(loadedQueue?.queue).toHaveLength(3);
    expect(loadedQueue?.queueIndex).toBe(1);

    saveRecentSearches(['Troye Sivan', 'Miles Davis']);
    expect(loadRecentSearches()).toEqual(['Troye Sivan', 'Miles Davis']);
  });
});
