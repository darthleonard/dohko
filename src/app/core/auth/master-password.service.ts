import { Injectable } from '@angular/core';
import { CryptoService } from '../crypto/crypto.service';
import { KeyDerivationService } from '../crypto/key-derivation.service';
import { KeyManagementService } from '../crypto/key-management.service';
import { DatabaseService } from '../database/database.service';

/**
 * MasterPasswordService
 *
 * Handles master password lifecycle:
 * - First-run vault initialization
 * - Password verification and DEK unwrapping
 * - Changing the master password with zero database re-encryption overhead
 */
@Injectable({
  providedIn: 'root'
})
export class MasterPasswordService {

  public static readonly MIN_PASSWORD_LENGTH = 8;

  constructor(
    private keyDerivation: KeyDerivationService,
    private keyManagement: KeyManagementService,
    private cryptoService: CryptoService,
    private dbService: DatabaseService
  ) {}

  /**
   * Initializes a brand new encrypted vault with the chosen master password.
   */
  public async setupVault(password: string): Promise<Uint8Array> {
    if (!password || password.length < MasterPasswordService.MIN_PASSWORD_LENGTH) {
      throw new Error(`Master password must be at least ${MasterPasswordService.MIN_PASSWORD_LENGTH} characters.`);
    }

    // 1. Generate KDF parameters with new 16-byte random salt
    const kdfParams = this.keyDerivation.createDefaultParameters();

    // 2. Derive 256-bit Key Encryption Key (KEK) using Argon2id
    const kek = await this.keyDerivation.deriveKey(password, kdfParams);

    // 3. Generate random 256-bit Data Encryption Key (DEK)
    const dek = this.cryptoService.generateDek();

    try {
      // 4. Wrap DEK with KEK via AES-256-GCM
      const wrappedDek = await this.keyManagement.wrapDek(dek, kek);

      // 5. Build and save cryptographic metadata
      const metadata = this.keyManagement.createInitialMetadata(kdfParams, wrappedDek);
      await this.keyManagement.saveMetadata(metadata);

      // 6. Initialize encrypted SQLCipher database
      const sqlCipherKey = this.keyManagement.getSqlCipherKey(dek);
      await this.dbService.openDatabase(sqlCipherKey);

      return dek;
    } finally {
      // Wipe ephemeral KEK from memory
      this.cryptoService.wipeBytes(kek);
    }
  }

  /**
   * Verifies master password and unwraps the vault's Data Encryption Key (DEK).
   */
  public async verifyAndUnlock(password: string): Promise<Uint8Array> {
    const metadata = await this.keyManagement.getMetadata();
    if (!metadata) {
      throw new Error('No vault found. Please create a new vault first.');
    }

    // 1. Derive KEK from entered password and stored salt
    const kek = await this.keyDerivation.deriveKey(password, metadata.kdf);

    try {
      // 2. Unwrap DEK with AES-256-GCM authenticated decryption
      const dek = await this.keyManagement.unwrapDek(metadata.wrappedDek, kek);
      return dek;
    } catch {
      throw new Error('Incorrect master password. Access denied.');
    } finally {
      // Wipe ephemeral KEK from memory
      this.cryptoService.wipeBytes(kek);
    }
  }

  /**
   * Changes the master password by re-encrypting the DEK with a newly derived KEK.
   * Does NOT require re-encrypting the SQLite database or individual credentials.
   */
  public async changeMasterPassword(
    currentPass: string,
    newPass: string,
    currentDek: Uint8Array
  ): Promise<void> {
    if (!newPass || newPass.length < MasterPasswordService.MIN_PASSWORD_LENGTH) {
      throw new Error(`New master password must be at least ${MasterPasswordService.MIN_PASSWORD_LENGTH} characters.`);
    }

    // Verify current master password first
    const verifiedDek = await this.verifyAndUnlock(currentPass);
    this.cryptoService.wipeBytes(verifiedDek);

    // Generate new KDF parameters and fresh salt
    const newKdfParams = this.keyDerivation.createDefaultParameters();
    const newKek = await this.keyDerivation.deriveKey(newPass, newKdfParams);

    try {
      // Re-wrap the existing DEK with the new KEK
      const newWrappedDek = await this.keyManagement.wrapDek(currentDek, newKek);

      const oldMeta = await this.keyManagement.getMetadata();
      const updatedMeta = {
        version: oldMeta?.version || 1,
        kdf: newKdfParams,
        wrappedDek: newWrappedDek,
        createdAt: oldMeta?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.keyManagement.saveMetadata(updatedMeta);
    } finally {
      this.cryptoService.wipeBytes(newKek);
    }
  }
}
