import { Injectable } from '@angular/core';
import { argon2id } from 'hash-wasm';

export interface KdfParameters {
  algorithm: 'Argon2id';
  version: number;
  memorySize: number; // in KiB (e.g., 65536 = 64 MB)
  iterations: number;
  parallelism: number;
  hashLength: number; // in bytes (32 = 256 bits)
  salt: string; // Base64 encoded 16-byte random salt
}

/**
 * KeyDerivationService
 *
 * Implements Argon2id password-based key derivation using WebAssembly (hash-wasm).
 *
 * Security Rationale & Parameter Benchmarks:
 * - Algorithm: Argon2id (hybrid data-dependent & data-independent memory addressing),
 *   protecting against both side-channel and GPU-accelerated brute-force attacks.
 * - Memory: 47,104 KiB (~46 MiB). OWASP-compliant (m=47104, t=1, p=1 profile).
 *   Reduced from 64 MiB to target ~300–500ms on mid-range Android WebAssembly runtimes
 *   while remaining resistant to offline GPU brute-force attacks.
 * - Iterations: 1 pass. With 46 MiB of memory, a single pass provides sufficient
 *   memory-hardness per the OWASP Password Storage Cheat Sheet (m=47104, t=1 is listed
 *   as an equivalent configuration to m=19456, t=2).
 * - Parallelism: 1 lane, tailored for single-worker/single-thread WebAssembly execution.
 * - Salt: 16 bytes (128 bits) of cryptographically secure random entropy.
 * - Output: 32 bytes (256 bits) Key Encryption Key (KEK).
 *
 * NOTE: Existing vaults are unaffected — KDF parameters are stored per-vault in metadata
 * and read back verbatim at unlock time. Only newly created vaults use these defaults.
 *
 * The parameters are versioned (version: 1) allowing seamless future parameter upgrades.
 */
@Injectable({
  providedIn: 'root'
})
export class KeyDerivationService {

  public static readonly CURRENT_VERSION = 1;
  public static readonly DEFAULT_MEMORY_KIB = 47104; // 46 MiB — OWASP m=47104,t=1 profile
  public static readonly DEFAULT_ITERATIONS = 1;
  public static readonly DEFAULT_PARALLELISM = 1;
  public static readonly DEFAULT_KEY_LENGTH = 32; // 256 bits
  public static readonly SALT_LENGTH_BYTES = 16; // 128 bits

  /**
   * Generates a new cryptographically random 16-byte salt and returns standard parameters.
   */
  public createDefaultParameters(): KdfParameters {
    const saltBytes = new Uint8Array(KeyDerivationService.SALT_LENGTH_BYTES);
    crypto.getRandomValues(saltBytes);

    return {
      algorithm: 'Argon2id',
      version: KeyDerivationService.CURRENT_VERSION,
      memorySize: KeyDerivationService.DEFAULT_MEMORY_KIB,
      iterations: KeyDerivationService.DEFAULT_ITERATIONS,
      parallelism: KeyDerivationService.DEFAULT_PARALLELISM,
      hashLength: KeyDerivationService.DEFAULT_KEY_LENGTH,
      salt: this.bytesToBase64(saltBytes)
    };
  }

  /**
   * Derives a 256-bit Key Encryption Key (KEK) from a password and KDF parameters.
   */
  public async deriveKey(password: string, params: KdfParameters): Promise<Uint8Array> {
    if (!password || password.length === 0) {
      throw new Error('Password cannot be empty for key derivation');
    }

    if (params.algorithm !== 'Argon2id') {
      throw new Error(`Unsupported KDF algorithm: ${params.algorithm}`);
    }

    const saltBytes = this.base64ToBytes(params.salt);
    if (saltBytes.length < 16) {
      throw new Error('Salt must be at least 16 bytes');
    }

    console.log(`[KeyDerivationService] KDF parameters: algorithm=${params.algorithm}, version=${params.version}, memorySize=${params.memorySize}, iterations=${params.iterations}, parallelism=${params.parallelism}, hashLength=${params.hashLength}`);

    const timerLabel = `[KeyDerivationService] argon2id execution`;
    console.time(timerLabel);
    console.log(`[KeyDerivationService] Starting argon2id() at ${new Date().toISOString()}`);

    try {
      // hash-wasm argon2id accepts Uint8Array salt and returns Uint8Array when outputType is 'binary'
      const derived = await argon2id({
        password,
        salt: saltBytes,
        iterations: params.iterations,
        memorySize: params.memorySize,
        hashLength: params.hashLength,
        parallelism: params.parallelism,
        outputType: 'binary'
      });

      console.log(`[KeyDerivationService] Completed argon2id() at ${new Date().toISOString()}`);
      return derived;
    } catch (err) {
      console.error(`[KeyDerivationService] Error in argon2id():`, err);
      throw err;
    } finally {
      console.timeEnd(timerLabel);
    }
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
}
