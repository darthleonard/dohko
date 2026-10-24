import { TestBed } from '@angular/core/testing';
import { BackupValidator } from './backup-validator';
import { BACKUP_FORMAT_IDENTIFIER, CURRENT_BACKUP_VERSION, EncryptedBackupFile } from './backup-format';

describe('BackupValidator', () => {
  let validator: BackupValidator;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BackupValidator]
    });
    validator = TestBed.inject(BackupValidator);
  });

  it('should validate valid backup file structure', () => {
    const validFile: EncryptedBackupFile = {
      format: BACKUP_FORMAT_IDENTIFIER,
      version: CURRENT_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      kdf: {
        algorithm: 'Argon2id',
        version: 1,
        memorySize: 65536,
        iterations: 3,
        parallelism: 1,
        hashLength: 32,
        salt: 'AQIDBAUGBwgJCgsMDQ4PEA=='
      },
      encryption: {
        algorithm: 'AES-256-GCM',
        iv: 'AQIDBAUGBwgJCgsM'
      },
      ciphertext: 'VGhpcyBpcyBhIHRlc3QgY2lwaGVydGV4dA=='
    };

    const res = validator.validateFileStructure(JSON.stringify(validFile));
    expect(res).toBeDefined();
    expect(res.format).toBe(BACKUP_FORMAT_IDENTIFIER);
  });

  it('should reject invalid format identifier', () => {
    const invalid = {
      format: 'unknown-format',
      version: 1,
      ciphertext: 'abc'
    };
    expect(() => validator.validateFileStructure(JSON.stringify(invalid))).toThrow();
  });

  it('should reject unsupported version', () => {
    const invalid = {
      format: BACKUP_FORMAT_IDENTIFIER,
      version: 999,
      ciphertext: 'abc'
    };
    expect(() => validator.validateFileStructure(JSON.stringify(invalid))).toThrow();
  });

  it('should validate valid decrypted payload', () => {
    const validPayload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      recordCount: 1,
      credentials: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Google',
          username: 'user@gmail.com',
          password: 'SecretPassword123!',
          websiteUrl: 'https://google.com',
          notes: 'Personal account',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };

    const creds = validator.validateDecryptedPayload(JSON.stringify(validPayload));
    expect(creds.length).toBe(1);
    expect(creds[0].name).toBe('Google');
  });

  it('should reject invalid UUIDs in payload', () => {
    const invalidPayload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      recordCount: 1,
      credentials: [
        {
          id: 'invalid-not-a-uuid',
          name: 'Google',
          username: 'user@gmail.com',
          password: 'Password',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };

    expect(() => validator.validateDecryptedPayload(JSON.stringify(invalidPayload))).toThrow();
  });
});
