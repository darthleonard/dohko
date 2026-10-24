import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  BACKUP_FORMAT_IDENTIFIER,
  CURRENT_BACKUP_VERSION,
  DecryptedBackupPayload,
  EncryptedBackupFile
} from './backup-format';
import { BackupValidator } from './backup-validator';
import { CryptoService } from '../crypto/crypto.service';
import { KeyDerivationService } from '../crypto/key-derivation.service';
import { CredentialRepository } from '../database/credential.repository';
import { VaultSessionService } from '../auth/vault-session.service';

/**
 * BackupService
 *
 * Implements password-protected encrypted vault export and transactional import.
 *
 * Security Rationale:
 * - Backups use an independent dedicated backup password, decoupled from device-bound keys.
 * - Uses Argon2id key derivation + AES-256-GCM authenticated encryption.
 * - Header fields (format, version, exportedAt) are authenticated as AES-GCM Additional
 *   Authenticated Data (AAD) to prevent tampering or header substitution attacks.
 * - Import restores records transactionally and never modifies the active vault if
 *   authentication, validation, or decryption fails.
 * - Temporary exported files in app-private storage are wiped after sharing.
 */
@Injectable({
  providedIn: 'root'
})
export class BackupService {

  constructor(
    private sessionService: VaultSessionService,
    private credentialRepo: CredentialRepository,
    private keyDerivation: KeyDerivationService,
    private cryptoService: CryptoService,
    private validator: BackupValidator
  ) {}

  /**
   * Generates and exports an encrypted backup file.
   *
   * @param backupPassword User-chosen dedicated backup password
   */
  public async exportBackup(backupPassword: string): Promise<string> {
    if (!this.sessionService.isUnlocked()) {
      throw new Error('Vault must be unlocked to export credentials.');
    }

    if (!backupPassword || backupPassword.length < 8) {
      throw new Error('Backup password must be at least 8 characters long.');
    }

    // 1. Collect all credentials from encrypted database
    const credentials = await this.credentialRepo.getAll();
    const now = new Date().toISOString();

    const payload: DecryptedBackupPayload = {
      schemaVersion: 1,
      exportedAt: now,
      recordCount: credentials.length,
      credentials
    };

    const payloadJson = JSON.stringify(payload);
    const payloadBytes = new TextEncoder().encode(payloadJson);

    // 2. Generate fresh salt and KDF parameters for backup key derivation
    const kdfParams = this.keyDerivation.createDefaultParameters();
    const backupKey = await this.keyDerivation.deriveKey(backupPassword, kdfParams);

    // 3. Prepare Additional Authenticated Data (AAD) binding header metadata
    const aadString = `${BACKUP_FORMAT_IDENTIFIER}|${CURRENT_BACKUP_VERSION}|${now}`;
    const aadBytes = new TextEncoder().encode(aadString);

    try {
      // 4. Encrypt payload with AES-256-GCM
      const encrypted = await this.cryptoService.encryptAesGcm(payloadBytes, backupKey, aadBytes);

      // 5. Build final backup structure
      const backupFile: EncryptedBackupFile = {
        format: BACKUP_FORMAT_IDENTIFIER,
        version: CURRENT_BACKUP_VERSION,
        exportedAt: now,
        kdf: kdfParams,
        encryption: {
          algorithm: 'AES-256-GCM',
          iv: encrypted.iv
        },
        ciphertext: encrypted.ciphertext
      };

      const fileContent = JSON.stringify(backupFile, null, 2);
      const fileName = `dohko_vault_backup_${Date.now()}.vault`;

      // 6. Native Share or Web Download
      if (Capacitor.isNativePlatform()) {
        const tempPath = `backups/${fileName}`;
        try {
          await Filesystem.writeFile({
            path: tempPath,
            data: fileContent,
            directory: Directory.Cache
          });

          const uriResult = await Filesystem.getUri({
            path: tempPath,
            directory: Directory.Cache
          });

          await Share.share({
            title: 'Dohko Vault Backup',
            text: 'Encrypted offline vault backup file (.vault)',
            url: uriResult.uri,
            dialogTitle: 'Save Encrypted Backup'
          });

          return fileName;
        } finally {
          // Clean up temporary cache file
          await Filesystem.deleteFile({
            path: tempPath,
            directory: Directory.Cache
          }).catch(() => {});
        }
      } else {
        // Web platform download fallback
        const blob = new Blob([fileContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        return fileName;
      }
    } finally {
      // Wipe derived backup key from memory
      this.cryptoService.wipeBytes(backupKey);
    }
  }

  /**
   * Validates and restores credentials from an encrypted backup file.
   *
   * @param fileContent Raw text content of the .vault backup file
   * @param backupPassword Password used to encrypt the backup
   */
  public async restoreBackup(fileContent: string, backupPassword: string): Promise<number> {
    if (!this.sessionService.isUnlocked()) {
      throw new Error('Vault must be unlocked to restore credentials.');
    }

    if (!backupPassword) {
      throw new Error('Backup password is required.');
    }

    // 1. Validate file structure and header
    const backupFile = this.validator.validateFileStructure(fileContent);

    // 2. Derive backup key using Argon2id with file's KDF parameters
    const backupKey = await this.keyDerivation.deriveKey(backupPassword, backupFile.kdf);

    // 3. Reconstruct AAD from header
    const aadString = `${backupFile.format}|${backupFile.version}|${backupFile.exportedAt}`;
    const aadBytes = new TextEncoder().encode(aadString);

    let decryptedBytes: Uint8Array;
    try {
      decryptedBytes = await this.cryptoService.decryptAesGcm(
        { iv: backupFile.encryption.iv, ciphertext: backupFile.ciphertext },
        backupKey,
        aadBytes
      );
    } catch {
      this.cryptoService.wipeBytes(backupKey);
      throw new Error('Incorrect backup password or corrupted backup file.');
    } finally {
      this.cryptoService.wipeBytes(backupKey);
    }

    // 4. Decode and validate decrypted payload against strict schema
    const payloadJson = new TextDecoder().decode(decryptedBytes);
    const restoredCredentials = this.validator.validateDecryptedPayload(payloadJson);

    // 5. Transactionally restore all credentials into encrypted database
    await this.credentialRepo.restoreAll(restoredCredentials);

    return restoredCredentials.length;
  }
}
