import { TestBed } from '@angular/core/testing';
import { KeyDerivationService } from './key-derivation.service';

describe('KeyDerivationService', () => {
  let service: KeyDerivationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [KeyDerivationService]
    });
    service = TestBed.inject(KeyDerivationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create default KDF parameters with 16-byte random salt', () => {
    const params = service.createDefaultParameters();
    expect(params.algorithm).toBe('Argon2id');
    expect(params.version).toBe(1);
    expect(params.memorySize).toBe(65536);
    expect(params.iterations).toBe(3);
    expect(params.parallelism).toBe(1);
    expect(params.hashLength).toBe(32);
    expect(params.salt).toBeDefined();

    const saltBytes = service.base64ToBytes(params.salt);
    expect(saltBytes.length).toBe(16);
  });

  it('should derive 256-bit key from password using Argon2id', async () => {
    const params = service.createDefaultParameters();
    // Use lower memory for speedy unit test verification
    params.memorySize = 1024;
    params.iterations = 1;

    const key = await service.deriveKey('masterPassword123!', params);
    expect(key).toBeDefined();
    expect(key.length).toBe(32);

    // Same password and parameters should yield identical key
    const keyAgain = await service.deriveKey('masterPassword123!', params);
    expect(key).toEqual(keyAgain);

    // Different password yields different key
    const differentKey = await service.deriveKey('differentPassword!', params);
    expect(key).not.toEqual(differentKey);
  });

  it('should reject empty password', async () => {
    const params = service.createDefaultParameters();
    await expect(service.deriveKey('', params)).rejects.toThrow();
  });
});
