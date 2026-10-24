import { TestBed } from '@angular/core/testing';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CryptoService]
    });
    service = TestBed.inject(CryptoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should generate 32-byte DEK', () => {
    const dek = service.generateDek();
    expect(dek).toBeDefined();
    expect(dek.length).toBe(32);
  });

  it('should encrypt and decrypt plaintext using AES-256-GCM', async () => {
    const rawKey = service.generateDek();
    const plaintext = new TextEncoder().encode('SuperSecretPassword123!');

    const encrypted = await service.encryptAesGcm(plaintext, rawKey);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();

    const decrypted = await service.decryptAesGcm(encrypted, rawKey);
    const decryptedText = new TextDecoder().decode(decrypted);

    expect(decryptedText).toBe('SuperSecretPassword123!');
  });

  it('should fail decryption if wrong key is provided', async () => {
    const key1 = service.generateDek();
    const key2 = service.generateDek();
    const plaintext = new TextEncoder().encode('SecretPayload');

    const encrypted = await service.encryptAesGcm(plaintext, key1);

    await expect(service.decryptAesGcm(encrypted, key2)).rejects.toThrow();
  });

  it('should authenticate Additional Authenticated Data (AAD)', async () => {
    const key = service.generateDek();
    const plaintext = new TextEncoder().encode('ProtectedData');
    const aad = new TextEncoder().encode('header-v1-metadata');
    const tamperedAad = new TextEncoder().encode('header-v2-tampered');

    const encrypted = await service.encryptAesGcm(plaintext, key, aad);

    // Correct AAD works
    const decrypted = await service.decryptAesGcm(encrypted, key, aad);
    expect(new TextDecoder().decode(decrypted)).toBe('ProtectedData');

    // Tampered AAD fails authentication
    await expect(service.decryptAesGcm(encrypted, key, tamperedAad)).rejects.toThrow();
  });

  it('should wipe memory buffers cleanly', () => {
    const buffer = new Uint8Array([1, 2, 3, 4, 5]);
    service.wipeBytes(buffer);
    expect(buffer.every(b => b === 0)).toBe(true);
  });
});
