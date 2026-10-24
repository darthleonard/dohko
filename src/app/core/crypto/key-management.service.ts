import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { CryptoService, EncryptedPayload } from './crypto.service';
import { KdfParameters } from './key-derivation.service';

export interface VaultMetadata {
  version: number;
  kdf: KdfParameters;
  wrappedDek: EncryptedPayload;
  createdAt: string;
  updatedAt: string;
}

/**
 * KeyManagementService
 *
 * Manages the cryptographic key hierarchy and lifecycle:
 * 1. Data Encryption Key (DEK): 256-bit random key used for data encryption and SQLCipher keying.
 * 2. Key Encryption Key (KEK): Derived from user's master password via Argon2id.
 * 3. Wrapped DEK: DEK encrypted with KEK via AES-256-GCM.
 *
 * Persists ONLY authenticated cryptographic metadata (salt, KDF parameters, wrapped DEK)
 * in Capacitor Preferences. Neither the master password, nor the KEK, nor the raw DEK
 * is ever stored in plaintext persistent storage.
 */
@Injectable({
  providedIn: 'root'
})
export class KeyManagementService {

  private static readonly METADATA_KEY = 'dohko_vault_metadata';
  private static readonly METADATA_VERSION = 1;
  private static readonly AAD_TAG = new TextEncoder().encode('dohko-dek-wrapper-v1');

  constructor(private cryptoService: CryptoService) {}

  /**
   * Checks whether a vault exists on this device.
   */
  public async hasVault(): Promise<boolean> {
    const meta = await this.getMetadata();
    return meta !== null && meta.wrappedDek !== undefined;
  }

  /**
   * Retrieves stored vault metadata. Returns null if not initialized.
   */
  public async getMetadata(): Promise<VaultMetadata | null> {
    try {
      const { value } = await Preferences.get({ key: KeyManagementService.METADATA_KEY });
      if (!value) {
        return null;
      }
      const parsed = JSON.parse(value) as VaultMetadata;
      if (!parsed.version || !parsed.kdf || !parsed.wrappedDek) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Atomically saves or updates vault metadata.
   */
  public async saveMetadata(metadata: VaultMetadata): Promise<void> {
    await Preferences.set({
      key: KeyManagementService.METADATA_KEY,
      value: JSON.stringify(metadata)
    });
  }

  /**
   * Clears vault metadata (used for complete reset).
   */
  public async clearMetadata(): Promise<void> {
    await Preferences.remove({ key: KeyManagementService.METADATA_KEY });
  }

  /**
   * Wraps a raw 256-bit DEK using the derived KEK with AES-256-GCM and authenticated data.
   */
  public async wrapDek(dek: Uint8Array, kek: Uint8Array): Promise<EncryptedPayload> {
    return this.cryptoService.encryptAesGcm(dek, kek, KeyManagementService.AAD_TAG);
  }

  /**
   * Unwraps the DEK using the derived KEK. Throws if the master password/KEK is invalid.
   */
  public async unwrapDek(wrapped: EncryptedPayload, kek: Uint8Array): Promise<Uint8Array> {
    return this.cryptoService.decryptAesGcm(wrapped, kek, KeyManagementService.AAD_TAG);
  }

  /**
   * Constructs initial vault metadata.
   */
  public createInitialMetadata(kdfParams: KdfParameters, wrappedDek: EncryptedPayload): VaultMetadata {
    const now = new Date().toISOString();
    return {
      version: KeyManagementService.METADATA_VERSION,
      kdf: kdfParams,
      wrappedDek,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Derives SQLCipher key string (64-character hexadecimal representation of 256-bit DEK).
   */
  public getSqlCipherKey(dek: Uint8Array): string {
    return this.cryptoService.bytesToHex(dek);
  }
}
