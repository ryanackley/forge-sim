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
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

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

  // ── Setup ─────────────────────────────────────────────────────────────

  /**
   * Load translations from a Forge app directory.
   * Looks for `__LOCALES__/` in the app's `src/` directory first,
   * then falls back to root.
   */
  loadFromAppDir(appDir: string): boolean {
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
  }

  /**
   * Set i18n config programmatically.
   */
  setConfig(config: I18nInfoConfig): void {
    this.overrideConfig = config;
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
