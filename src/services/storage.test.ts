import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadTasteProfile,
  saveTasteProfile,
  loadApiVault,
  saveApiVault,
  loadPlaylists,
  savePlaylists,
  resetVaultSecrets,
  STORAGE_VERSION,
} from './storage';

describe('storage service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a valid default TasteProfile when storage is empty', () => {
    const profile = loadTasteProfile();
    expect(profile.version).toBe(STORAGE_VERSION);
    expect(profile.displayName).toBe('Manoj');
    expect(profile.likedTrackIds.length).toBeGreaterThan(0);
    expect(Object.keys(profile.genreWeights).length).toBeGreaterThan(0);
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
    expect(profile.displayName).toBe('Manoj');
  });

  it('saves and loads API Vault keys and clears them on reset', () => {
    const vault = loadApiVault();
    expect(vault.theAudioDbApiKey).toBe('123');

    saveApiVault({
      ...vault,
      lastfmApiKey: 'test-lastfm-key',
      tastediveApiKey: 'test-td-key',
    });

    const loaded = loadApiVault();
    expect(loaded.lastfmApiKey).toBe('test-lastfm-key');
    expect(loaded.tastediveApiKey).toBe('test-td-key');

    const cleared = resetVaultSecrets();
    expect(cleared.lastfmApiKey).toBe('');
    expect(cleared.tastediveApiKey).toBe('');
  });

  it('loads default playlists and persists newly created playlists', () => {
    const initial = loadPlaylists();
    expect(initial.some((p) => p.name === 'Liked Vibes')).toBe(true);

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
});
