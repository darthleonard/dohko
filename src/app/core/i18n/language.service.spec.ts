import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';
import { LanguageService } from './language.service';

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe('LanguageService', () => {
  let service: LanguageService;

  beforeEach(() => {
    vi.mocked(Preferences.get).mockResolvedValue({ value: null });
    vi.mocked(Preferences.set).mockResolvedValue();
    TestBed.configureTestingModule({
      providers: [LanguageService],
    });
    service = TestBed.inject(LanguageService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the device language when no preference has been saved', async () => {
    vi.stubGlobal('navigator', {
      language: 'es-MX',
      languages: ['es-MX'],
    });

    await service.initialize();

    expect(service.currentLanguage()).toBe('es-MX');
  });

  it('prefers the saved language over the current device language', async () => {
    vi.mocked(Preferences.get).mockResolvedValue({ value: 'en-US' });
    vi.stubGlobal('navigator', {
      language: 'es-MX',
      languages: ['es-MX'],
    });

    await service.initialize();

    expect(service.currentLanguage()).toBe('en-US');
  });

  it('saves the language selection independently of the vault session', async () => {
    await service.setLanguage('es-MX');

    expect(Preferences.set).toHaveBeenCalledWith({
      key: 'app.language',
      value: 'es-MX',
    });
    expect(service.currentLanguage()).toBe('es-MX');
  });

  it('resolves translations and interpolation in the selected language', async () => {
    await service.setLanguage('es-MX');

    expect(service.instant('ONBOARDING.ERROR_PASSWORD_MIN_LENGTH', {
      minLength: 8,
    })).toBe('La contraseña maestra debe tener al menos 8 caracteres.');
  });
});
