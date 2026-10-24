import { Injectable } from '@angular/core';

export interface EncryptedPayload {
  iv: string; // Base64 encoded 12-byte IV
  ciphertext: string; // Base64 encoded ciphertext + 16-byte GCM authentication tag
}

/**
 * CryptoService
 *
 * Implements authenticated symmetric encryption using AES-256-GCM via the standard WebCrypto API.
 * Guarantees authenticated confidentiality and integrity with hardware-accelerated AES instructions.
 */
@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  public static readonly IV_LENGTH_BYTES = 12; // 96-bit standard nonce for GCM
  public static readonly KEY_LENGTH_BYTES = 32; // 256-bit AES key
  public static readonly TAG_LENGTH_BITS = 128; // 128-bit authentication tag

  /**
   * Generates cryptographically secure random bytes using CSPRNG.
   */
  public generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  /**
   * Generates a random 256-bit Data Encryption Key (DEK).
   */
  public generateDek(): Uint8Array {
    return this.generateRandomBytes(CryptoService.KEY_LENGTH_BYTES);
  }

  /**
   * Encrypts plaintext bytes using AES-256-GCM with a fresh random 12-byte IV.
   *
   * @param plaintext Bytes to encrypt
   * @param rawKey 256-bit raw key
   * @param aad Optional Additional Authenticated Data
   */
  public async encryptAesGcm(
    plaintext: Uint8Array,
    rawKey: Uint8Array,
    aad?: Uint8Array
  ): Promise<EncryptedPayload> {
    if (rawKey.length !== CryptoService.KEY_LENGTH_BYTES) {
      throw new Error(`AES-256 requires exactly 32-byte key, received ${rawKey.length}`);
    }

    const iv = this.generateRandomBytes(CryptoService.IV_LENGTH_BYTES);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      rawKey as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const algorithm: AesGcmParams = {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: CryptoService.TAG_LENGTH_BITS
    };

    if (aad && aad.length > 0) {
      algorithm.additionalData = aad as BufferSource;
    }

    const encryptedBuffer = await crypto.subtle.encrypt(
      algorithm,
      cryptoKey,
      plaintext as BufferSource
    );

    return {
      iv: this.bytesToBase64(iv),
      ciphertext: this.bytesToBase64(new Uint8Array(encryptedBuffer))
    };
  }

  /**
   * Decrypts AES-256-GCM ciphertext. Throws an error if key, IV, ciphertext, or AAD are modified.
   *
   * @param payload Encrypted payload (IV + ciphertext with tag)
   * @param rawKey 256-bit raw key
   * @param aad Optional Additional Authenticated Data
   */
  public async decryptAesGcm(
    payload: EncryptedPayload,
    rawKey: Uint8Array,
    aad?: Uint8Array
  ): Promise<Uint8Array> {
    if (rawKey.length !== CryptoService.KEY_LENGTH_BYTES) {
      throw new Error(`AES-256 requires exactly 32-byte key, received ${rawKey.length}`);
    }

    const iv = this.base64ToBytes(payload.iv);
    const ciphertext = this.base64ToBytes(payload.ciphertext);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      rawKey as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const algorithm: AesGcmParams = {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: CryptoService.TAG_LENGTH_BITS
    };

    if (aad && aad.length > 0) {
      algorithm.additionalData = aad as BufferSource;
    }

    try {
      const decryptedBuffer = await crypto.subtle.decrypt(
        algorithm,
        cryptoKey,
        ciphertext as BufferSource
      );

      return new Uint8Array(decryptedBuffer);
    } catch {
      throw new Error('Authentication tag mismatch or corrupted ciphertext. Decryption failed.');
    }
  }

  /**
   * Converts byte array to hex string.
   */
  public bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Converts hex string to byte array.
   */
  public hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
      throw new Error('Invalid hex string length');
    }
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  public bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  public base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Explicitly zeros out mutable memory buffer to minimize lifetime of plaintext secrets.
   */
  public wipeBytes(bytes: Uint8Array | null | undefined): void {
    if (bytes) {
      bytes.fill(0);
    }
  }
}
