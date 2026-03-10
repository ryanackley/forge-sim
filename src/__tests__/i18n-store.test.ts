/**
 * Tests for I18nStore — translation file loading, fallback chains,
 * dot-path key resolution, and programmatic overrides.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { I18nStore } from '../i18n-store.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Test fixtures ───────────────────────────────────────────────────────

const EN_US = {
  greeting: 'Hello',
  farewell: 'Goodbye',
  nav: {
    home: 'Home',
    settings: 'Settings',
    nested: {
      deep: 'Deep value',
    },
  },
};

const FR_FR = {
  greeting: 'Bonjour',
  farewell: 'Au revoir',
  nav: {
    home: 'Accueil',
    settings: 'Paramètres',
    nested: {
      deep: 'Valeur profonde',
    },
  },
};

const JA_JP = {
  greeting: 'こんにちは',
  farewell: 'さようなら',
};

const I18N_INFO = {
  config: {
    locales: ['en-US', 'fr-FR', 'ja-JP'],
    fallback: {
      default: 'en-US',
      'fr-FR': ['en-US'],
      'ja-JP': ['en-US'],
      'de-DE': ['en-US'],
    },
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────

let tempDir: string;

function createTempAppDir(layout: 'src' | 'root' = 'src'): string {
  tempDir = join(tmpdir(), `forge-sim-i18n-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const localesDir = layout === 'src'
    ? join(tempDir, 'src', '__LOCALES__')
    : join(tempDir, '__LOCALES__');

  mkdirSync(localesDir, { recursive: true });
  writeFileSync(join(localesDir, 'i18n-info.json'), JSON.stringify(I18N_INFO));
  writeFileSync(join(localesDir, 'en-US.json'), JSON.stringify(EN_US));
  writeFileSync(join(localesDir, 'fr-FR.json'), JSON.stringify(FR_FR));
  writeFileSync(join(localesDir, 'ja-JP.json'), JSON.stringify(JA_JP));

  return tempDir;
}

function cleanupTempDir(): void {
  if (tempDir) {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('I18nStore', () => {
  let store: I18nStore;

  beforeEach(() => {
    store = new I18nStore();
  });

  afterEach(() => {
    cleanupTempDir();
  });

  // ── Loading ─────────────────────────────────────────────────────────

  describe('loadFromAppDir', () => {
    it('loads from src/__LOCALES__/', () => {
      const appDir = createTempAppDir('src');
      expect(store.loadFromAppDir(appDir)).toBe(true);
      expect(store.hasTranslations).toBe(true);
    });

    it('loads from root __LOCALES__/', () => {
      const appDir = createTempAppDir('root');
      expect(store.loadFromAppDir(appDir)).toBe(true);
      expect(store.hasTranslations).toBe(true);
    });

    it('prefers src/__LOCALES__ over root', () => {
      const appDir = createTempAppDir('src');
      // Also create root __LOCALES__ with different content
      const rootLocales = join(appDir, '__LOCALES__');
      mkdirSync(rootLocales, { recursive: true });
      writeFileSync(join(rootLocales, 'en-US.json'), JSON.stringify({ greeting: 'Root Hello' }));

      store.loadFromAppDir(appDir);
      // Should read from src/, not root
      return store.getTranslationResource('en-US').then(res => {
        expect(res.greeting).toBe('Hello'); // from src/__LOCALES__
      });
    });

    it('returns false when no __LOCALES__ directory exists', () => {
      const appDir = join(tmpdir(), `forge-sim-i18n-empty-${Date.now()}`);
      mkdirSync(appDir, { recursive: true });
      tempDir = appDir; // for cleanup
      expect(store.loadFromAppDir(appDir)).toBe(false);
      expect(store.hasTranslations).toBe(false);
    });
  });

  // ── Config ──────────────────────────────────────────────────────────

  describe('getI18nInfoConfig', () => {
    it('reads i18n-info.json from disk', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      const config = await store.getI18nInfoConfig();
      expect(config.locales).toEqual(['en-US', 'fr-FR', 'ja-JP']);
      expect(config.fallback.default).toBe('en-US');
    });

    it('returns override config when set programmatically', async () => {
      store.setConfig({
        locales: ['de-DE'],
        fallback: { default: 'de-DE' },
      });

      const config = await store.getI18nInfoConfig();
      expect(config.locales).toEqual(['de-DE']);
    });

    it('returns minimal default when no locales dir and no overrides', async () => {
      const config = await store.getI18nInfoConfig();
      expect(config.locales).toEqual(['en-US']);
      expect(config.fallback.default).toBe('en-US');
    });

    it('uses override locales for default config when overrides exist', async () => {
      store.setTranslations('pt-BR', { hello: 'Olá' });

      const config = await store.getI18nInfoConfig();
      expect(config.locales).toContain('pt-BR');
      expect(config.fallback.default).toBe('pt-BR');
    });
  });

  // ── Translation Resources ──────────────────────────────────────────

  describe('getTranslationResource', () => {
    it('reads locale JSON from disk', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      const enUS = await store.getTranslationResource('en-US');
      expect(enUS.greeting).toBe('Hello');
      expect(enUS.farewell).toBe('Goodbye');
    });

    it('reads nested translation objects', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      const enUS = await store.getTranslationResource('en-US');
      expect((enUS.nav as any).home).toBe('Home');
    });

    it('caches resources after first read', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      const first = await store.getTranslationResource('en-US');
      const second = await store.getTranslationResource('en-US');
      expect(first).toBe(second); // same reference
    });

    it('throws for unknown locale', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      await expect(store.getTranslationResource('xx-XX')).rejects.toThrow('xx-XX');
    });

    it('returns programmatic overrides over disk files', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      store.setTranslations('en-US', { greeting: 'Overridden!' });

      const enUS = await store.getTranslationResource('en-US');
      expect(enUS.greeting).toBe('Overridden!');
    });
  });

  // ── getTranslations ─────────────────────────────────────────────────

  describe('getTranslations', () => {
    it('returns translations for a valid locale', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      const result = await store.getTranslations('fr-FR');
      expect(result.locale).toBe('fr-FR');
      expect(result.translations?.greeting).toBe('Bonjour');
    });

    it('falls back when locale is missing and fallback=true', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      // de-DE doesn't exist as a file, but fallback chain says de-DE → en-US
      const result = await store.getTranslations('de-DE', { fallback: true });
      expect(result.locale).toBe('en-US');
      expect(result.translations?.greeting).toBe('Hello');
    });

    it('returns null translations when locale missing and fallback=false', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      const result = await store.getTranslations('de-DE', { fallback: false });
      expect(result.locale).toBe('de-DE');
      expect(result.translations).toBeNull();
    });

    it('falls back to default locale as last resort', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      // Use a locale with no fallback chain entry
      const result = await store.getTranslations('ko-KR', { fallback: true });
      expect(result.locale).toBe('en-US'); // default fallback
      expect(result.translations?.greeting).toBe('Hello');
    });

    it('works with programmatic overrides only (no disk)', async () => {
      store.setTranslations('en-US', { hello: 'Hi there' });

      const result = await store.getTranslations('en-US');
      expect(result.translations?.hello).toBe('Hi there');
    });
  });

  // ── createTranslationFunction ─────────────────────────────────────

  describe('createTranslationFunction', () => {
    it('creates a function that translates simple keys', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      const t = await store.createTranslationFunction('en-US');
      expect(t('greeting')).toBe('Hello');
      expect(t('farewell')).toBe('Goodbye');
    });

    it('resolves dot-path keys', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      const t = await store.createTranslationFunction('en-US');
      expect(t('nav.home')).toBe('Home');
      expect(t('nav.settings')).toBe('Settings');
      expect(t('nav.nested.deep')).toBe('Deep value');
    });

    it('returns defaultValue for missing keys', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      const t = await store.createTranslationFunction('en-US');
      expect(t('missing.key', 'Fallback')).toBe('Fallback');
    });

    it('returns key itself when no defaultValue and key is missing', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      const t = await store.createTranslationFunction('en-US');
      expect(t('missing.key')).toBe('missing.key');
    });

    it('works with different locales', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      const tEN = await store.createTranslationFunction('en-US');
      const tFR = await store.createTranslationFunction('fr-FR');
      const tJA = await store.createTranslationFunction('ja-JP');

      expect(tEN('greeting')).toBe('Hello');
      expect(tFR('greeting')).toBe('Bonjour');
      expect(tJA('greeting')).toBe('こんにちは');
    });

    it('returns identity function when no translations loaded', async () => {
      // No app dir, no overrides
      const t = await store.createTranslationFunction('en-US');
      expect(t('some.key')).toBe('some.key');
      expect(t('some.key', 'Default')).toBe('Default');
    });
  });

  // ── clear ──────────────────────────────────────────────────────────

  describe('clear', () => {
    it('resets all state', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);
      store.setTranslations('xx-XX', { test: 'value' });

      expect(store.hasTranslations).toBe(true);

      store.clear();

      expect(store.hasTranslations).toBe(false);
    });
  });

  // ── hasTranslations ────────────────────────────────────────────────

  describe('hasTranslations', () => {
    it('false by default', () => {
      expect(store.hasTranslations).toBe(false);
    });

    it('true after loading from app dir', () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);
      expect(store.hasTranslations).toBe(true);
    });

    it('true after programmatic setTranslations', () => {
      store.setTranslations('en-US', { key: 'value' });
      expect(store.hasTranslations).toBe(true);
    });
  });

  // ── getAvailableLocales ────────────────────────────────────────────

  describe('getAvailableLocales', () => {
    it('returns locales from i18n-info.json', async () => {
      const appDir = createTempAppDir();
      store.loadFromAppDir(appDir);

      const locales = await store.getAvailableLocales();
      expect(locales).toEqual(['en-US', 'fr-FR', 'ja-JP']);
    });
  });
});
