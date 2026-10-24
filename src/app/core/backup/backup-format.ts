import { KdfParameters } from '../crypto/key-derivation.service';
import { Credential } from '../database/credential.repository';

export const BACKUP_FORMAT_IDENTIFIER = 'dohko-vault-backup';
export const CURRENT_BACKUP_VERSION = 1;
export const MAX_BACKUP_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
export const MAX_BACKUP_RECORDS_COUNT = 10000;

export interface BackupHeader {
  format: typeof BACKUP_FORMAT_IDENTIFIER;
  version: number;
  exportedAt: string;
  kdf: KdfParameters;
  encryption: {
    algorithm: 'AES-256-GCM';
    iv: string; // Base64 encoded 12-byte nonce
  };
}

export interface EncryptedBackupFile extends BackupHeader {
  ciphertext: string; // Base64 encoded AES-256-GCM ciphertext + 16-byte tag
}

export interface DecryptedBackupPayload {
  schemaVersion: number;
  exportedAt: string;
  recordCount: number;
  credentials: Credential[];
}
