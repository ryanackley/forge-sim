/**
 * I18nStore — loads and serves translation resources from a Forge app's
 * `__LOCALES__` directory (or a configured i18n path).
 *
 * Forge apps bundle translations as:
 *   src/
 *     __LOCALES__/
 *       i18n-info.json    ← config: supported locales, fallback chain
 *       en-US.json         ← { "greeting": "Hello", "nav.home": "Home" }
 *       fr-FR.json         ← { "greeting": "Bonjour", "nav.home": "Accueil" }
 *
 * The `@forge/bridge` i18n module fetches these via HTTP in the browser.
 * In server-side rendering (forge-sim), we read them from disk instead.
 *
 * This store implements the same `I18nResourcesAccessor` interface that
 * `@forge/i18n`'s `TranslationsGetter` expects, so we can plug directly
 * into the real translation pipeline.
 */

import { readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

// Re-export the constant so consumers don't need @forge/i18n directly
const I18N_BUNDLE_FOLDER_NAME = '__LOCALES__';
const I18N_INFO_FILE_NAME = 'i18n-info.json';

/** Shape of a single translation resource (nested key-value) */
export interface TranslationResource {
  [key: string]: string | TranslationResource;
}

/** i18n-info.json config section */
export interface I18nInfoConfig {
  locales: string[];
  fallback: { [locale: string]: string[] | string } & { default: string };
}

/** Result of getTranslations() */
export interface GetTranslationsResult {
  locale: string;
  translations: TranslationResource | null;
}

/**
 * Clear the REAL `@forge/api`'s backend-i18n caches.
 *
 * Its `TranslationsGetter` is a MODULE-LEVEL singleton that memoizes both the
 * info config and each locale's resource. Since the app now runs the real
 * package (bare-seam migration), that cache outlives any individual simulator
 * — a second `createSimulator()` would otherwise serve the first one's
 * translations, or look for a locale file in a directory that no longer has
 * it. The sim owns this lifecycle, so it resets the cache whenever the
 * underlying translations change.
 *
 * Reached through the package's internal module because `@forge/api` does not
 * re-export `resetTranslationsCache` at the top level. Best-effort: a future
 * version that moves or drops it must not break the store.
 */
function invalidateRealI18nCache(): void {
  try {
    createRequire(import.meta.url)('@forge/api/out/api/i18n.js').resetTranslationsCache?.();
  } catch {
    // Not resolvable (or renamed upstream) — the cache simply keeps its
    // previous contents; nothing here is load-bearing for correctness of the
    // store itself.
  }
}

export class I18nStore {
  /** Absolute path to the __LOCALES__ directory */
  private localesDir: string | null = null;

  /** Cached i18n-info.json config */
  private infoConfig: I18nInfoConfig | null = null;

  /** Cached translation resources by locale */
  private resources = new Map<string, TranslationResource>();

  /** In-memory overrides (for testing without files) */
  private overrides = new Map<string, TranslationResource>();
  private overrideConfig: I18nInfoConfig | null = null;

  /** Temp dir holding the materialized __LOCALES__ bundle (see i18nRootDir). */
  private materializedDir: string | null = null;

  constructor() {
    // A fresh store means fresh translations; the real package's singleton
    // getter would otherwise serve the PREVIOUS simulator's cached config and
    // then fail looking for its locale files in this one's directory.
    invalidateRealI18nCache();
  }

  // ── Setup ─────────────────────────────────────────────────────────────

  /**
   * Load translations from a Forge app directory.
   * Looks for `__LOCALES__/` in the app's `src/` directory first,
   * then falls back to root.
   */
  loadFromAppDir(appDir: string): boolean {
    invalidateRealI18nCache();
    // Check src/__LOCALES__ first (standard Forge layout)
    const srcLocales = resolve(appDir, 'src', I18N_BUNDLE_FOLDER_NAME);
    if (existsSync(srcLocales)) {
      this.localesDir = srcLocales;
      this.infoConfig = null;
      this.resources.clear();
      return true;
    }

    // Then root __LOCALES__
    const rootLocales = resolve(appDir, I18N_BUNDLE_FOLDER_NAME);
    if (existsSync(rootLocales)) {
      this.localesDir = rootLocales;
      this.infoConfig = null;
      this.resources.clear();
      return true;
    }

    return false;
  }

  /**
   * Set translations programmatically (for tests or CLI overrides).
   */
  setTranslations(locale: string, translations: TranslationResource): void {
    this.overrides.set(locale, translations);
    invalidateRealI18nCache();
  }

  /**
   * Set i18n config programmatically.
   */
  setConfig(config: I18nInfoConfig): void {
    this.overrideConfig = config;
    invalidateRealI18nCache();
  }

  /**
   * The directory to report as the runtime's `container.appCodeDir`, so the
   * REAL `@forge/api`'s backend i18n can find these translations.
   *
   * Backend i18n is a FILESYSTEM contract, not a network one: `getTranslations`
   * reads `<appCodeDir>/__LOCALES__/i18n-info.json` and `<locale>.json` off
   * disk (`@forge/api/out/api/i18n.js:8-11`). Two consequences this method
   * exists to handle:
   *
   *  - The standard Forge layout puts locales at `<app>/src/__LOCALES__`, so
   *    reporting the app ROOT as appCodeDir would make the real package look
   *    in `<app>/__LOCALES__` and silently find nothing. We report the parent
   *    of whatever directory we actually loaded.
   *  - `setTranslations()` keeps translations in memory, which the real
   *    package cannot see at all. When any programmatic translation exists we
   *    materialize the merged view (disk + overrides) into a temp
   *    `__LOCALES__` directory and point appCodeDir there.
   *
   * Returns null when there is nothing to serve, leaving appCodeDir to the
   * deployed app directory.
   */
  i18nRootDir(): string | null {
    if (this.overrides.size === 0 && !this.overrideConfig) {
      return this.localesDir ? dirname(this.localesDir) : null;
    }

    if (!this.materializedDir) {
      this.materializedDir = mkdtempSync(join(tmpdir(), 'forge-sim-locales-'));
    }
    const bundleDir = join(this.materializedDir, I18N_BUNDLE_FOLDER_NAME);
    mkdirSync(bundleDir, { recursive: true });

    // Synchronous on purpose: this is read from the __forge_runtime__ getter,
    // which cannot await, and the payload is a handful of small JSON files.
    const config = this.i18nConfigSync();
    writeFileSync(join(bundleDir, I18N_INFO_FILE_NAME), JSON.stringify({ config }), 'utf-8');
    for (const locale of config.locales) {
      const resource = this.overrides.get(locale) ?? this.resources.get(locale);
      if (!resource) continue; // declared but unresourced, same as on disk
      writeFileSync(join(bundleDir, `${locale}.json`), JSON.stringify(resource), 'utf-8');
    }
    return this.materializedDir;
  }

  /** The config as far as it is knowable without touching disk. */
  private i18nConfigSync(): I18nInfoConfig {
    if (this.overrideConfig) return this.overrideConfig;
    if (this.infoConfig) {
      // Merge in any programmatic locales layered on top of a loaded bundle.
      const locales = [...new Set([...this.infoConfig.locales, ...this.overrides.keys()])];
      return { ...this.infoConfig, locales };
    }
    const overrideLocales = [...this.overrides.keys()];
    const defaultLocale = overrideLocales[0] || 'en-US';
    return {
      locales: overrideLocales.length > 0 ? overrideLocales : [defaultLocale],
      fallback: { default: defaultLocale },
    };
  }

  // ── I18nResourcesAccessor interface ───────────────────────────────────
  // These match what @forge/i18n's TranslationsGetter expects.

  async getI18nInfoConfig(): Promise<I18nInfoConfig> {
    // Programmatic config takes priority
    if (this.overrideConfig) {
      return this.overrideConfig;
    }

    // Return cached
    if (this.infoConfig) {
      return this.infoConfig;
    }

    if (!this.localesDir) {
      // No locales directory — return a minimal default config
      const overrideLocales = [...this.overrides.keys()] as string[];
      const defaultLocale = overrideLocales[0] || 'en-US';
      return {
        locales: overrideLocales.length > 0 ? overrideLocales : [defaultLocale],
        fallback: { default: defaultLocale },
      };
    }

    const infoPath = join(this.localesDir, I18N_INFO_FILE_NAME);
    try {
      const raw = await readFile(infoPath, 'utf-8');
      const info = JSON.parse(raw);
      this.infoConfig = info.config ?? info;
      return this.infoConfig!;
    } catch (err) {
      throw new Error(
        `[forge-sim] Failed to read ${I18N_INFO_FILE_NAME} from ${this.localesDir}: ${(err as Error).message}`
      );
    }
  }

  async getTranslationResource(locale: string): Promise<TranslationResource> {
    // Programmatic overrides take priority
    if (this.overrides.has(locale)) {
      return this.overrides.get(locale)!;
    }

    // Return cached
    if (this.resources.has(locale)) {
      return this.resources.get(locale)!;
    }

    if (!this.localesDir) {
      throw new Error(`[forge-sim] No locale files loaded. No translation resource for: ${locale}`);
    }

    const filePath = join(this.localesDir, `${locale}.json`);
    try {
      const raw = await readFile(filePath, 'utf-8');
      const translations = JSON.parse(raw);
      this.resources.set(locale, translations);
      return translations;
    } catch (err) {
      throw new Error(
        `[forge-sim] Failed to read translation resource for locale "${locale}" from ${filePath}: ${(err as Error).message}`
      );
    }
  }

  // ── High-level API ────────────────────────────────────────────────────

  /**
   * Get translations for a locale, with optional fallback.
   * Mirrors @forge/bridge's i18n.getTranslations() behavior.
   */
  async getTranslations(
    locale: string,
    options: { fallback: boolean } = { fallback: true }
  ): Promise<GetTranslationsResult> {
    try {
      const translations = await this.getTranslationResource(locale);
      return { locale, translations };
    } catch {
      if (!options.fallback) {
        return { locale, translations: null };
      }

      // Try fallback chain
      const config = await this.getI18nInfoConfig();
      const raw = config.fallback[locale];
      const fallbackLocales: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const fb of fallbackLocales) {
        try {
          const translations = await this.getTranslationResource(fb);
          return { locale: fb, translations };
        } catch {
          continue;
        }
      }

      // Last resort: default fallback
      if (config.fallback.default && config.fallback.default !== locale) {
        try {
          const translations = await this.getTranslationResource(config.fallback.default);
          return { locale: config.fallback.default, translations };
        } catch {
          // Give up
        }
      }

      return { locale, translations: null };
    }
  }

  /**
   * Create a translation function for a locale.
   * Mirrors @forge/bridge's i18n.createTranslationFunction().
   */
  async createTranslationFunction(
    locale: string
  ): Promise<(key: string, defaultValue?: string) => string> {
    const result = await this.getTranslations(locale);
    const translations = result.translations;

    return (key: string, defaultValue?: string): string => {
      if (!translations) {
        return defaultValue ?? key;
      }

      // Support dot-path keys: "nav.home" → translations.nav.home
      const value = getNestedValue(translations, key);
      if (typeof value === 'string') {
        return value;
      }

      return defaultValue ?? key;
    };
  }

  // ── Utility ───────────────────────────────────────────────────────────

  /** Whether any translations are available (loaded or overridden) */
  get hasTranslations(): boolean {
    return this.localesDir !== null || this.overrides.size > 0;
  }

  /** List available locales */
  async getAvailableLocales(): Promise<string[]> {
    const config = await this.getI18nInfoConfig();
    return config.locales;
  }

  /** Clear everything */
  clear(): void {
    this.localesDir = null;
    this.infoConfig = null;
    this.resources.clear();
    this.overrides.clear();
    this.overrideConfig = null;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Resolve a dot-path key against a nested translation object.
 * "nav.home" → obj.nav.home
 */
function getNestedValue(obj: TranslationResource, key: string): string | undefined {
  const parts = key.split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }

  return typeof current === 'string' ? current : undefined;
}
