import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import enUs from '../../../assets/i18n/en-US.json';
import esMx from '../../../assets/i18n/es-MX.json';

export type AppLanguage = 'en-US' | 'es-MX';

const LANGUAGE_PREFERENCE_KEY = 'app.language';

type TranslationTree = {
  [key: string]: string | TranslationTree;
};

const translations: Record<AppLanguage, TranslationTree> = {
  'en-US': enUs,
  'es-MX': esMx,
};

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly languageState = signal<AppLanguage>('en-US');
  public readonly currentLanguage = this.languageState.asReadonly();

  public get currentLang(): AppLanguage {
    return this.languageState();
  }

  public async initialize(): Promise<void> {
    const { value } = await Preferences.get({ key: LANGUAGE_PREFERENCE_KEY });
    const language = this.isAppLanguage(value)
      ? value
      : this.getDeviceLanguage();

    this.languageState.set(language);
    this.updateDocumentLanguage(language);
  }

  public async setLanguage(language: AppLanguage): Promise<void> {
    if (!this.isAppLanguage(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    await Preferences.set({
      key: LANGUAGE_PREFERENCE_KEY,
      value: language,
    });
    this.languageState.set(language);
    this.updateDocumentLanguage(language);
  }

  public instant(key: string, params?: Record<string, string | number>): string {
    const value = this.getTranslation(translations[this.currentLang], key)
      ?? this.getTranslation(translations['en-US'], key);
    if (typeof value !== 'string') {
      return key;
    }

    return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => {
      const replacement = params?.[name];
      return replacement === undefined ? match : String(replacement);
    });
  }

  public isAppLanguage(value: unknown): value is AppLanguage {
    return value === 'en-US' || value === 'es-MX';
  }

  private getDeviceLanguage(): AppLanguage {
    const language = navigator.language || navigator.languages?.[0] || 'en-US';

    return /^es(?:-|$)/i.test(language) ? 'es-MX' : 'en-US';
  }

  private updateDocumentLanguage(language: AppLanguage): void {
    document.documentElement.lang = language;
    document.title = this.instant('APP.NAME');
  }

  private getTranslation(tree: TranslationTree, key: string): string | TranslationTree | undefined {
    return key.split('.').reduce<string | TranslationTree | undefined>(
      (value, part) => {
        if (!value || typeof value === 'string') {
          return undefined;
        }
        return value[part];
      },
      tree,
    );
  }
}
