import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { CryptoService } from '../crypto/crypto.service';

interface VaultSecurityPluginInterface {
  setSecure(options: { enabled: boolean }): Promise<{ secure: boolean }>;
  checkBiometrics(): Promise<{ isAvailable: boolean; isEnrolled: boolean; status: number }>;
  enrollBiometrics(options: { token: string }): Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
  unlockWithBiometrics(): Promise<{
    success: boolean;
    token?: string;
    invalidated?: boolean;
    cancelled?: boolean;
    error?: string;
  }>;
  disableBiometrics(): Promise<{ success: boolean }>;
}

const VaultSecurity = registerPlugin<VaultSecurityPluginInterface>('VaultSecurity');

export interface BiometricStatus {
  available: boolean;
  enrolled: boolean;
  reason?: string;
}

export interface BiometricUnlockResult {
  success: boolean;
  dek?: Uint8Array;
  invalidated?: boolean;
  cancelled?: boolean;
  error?: string;
}

/**
 * BiometricService
 *
 * Provides hardware-backed Android Keystore biometric authentication.
 *
 * Security Guarantees:
 * - Uses Android Keystore AES-256-GCM cipher with setUserAuthenticationRequired(true)
 *   and setInvalidatedByBiometricEnrollment(true).
 * - Real cryptographic unwrapping of the DEK via BiometricPrompt.CryptoObject.
 * - Detects invalidated biometric keys (e.g. newly enrolled fingerprints).
 * - Master password fallback is always preserved.
 */
@Injectable({
  providedIn: 'root'
})
export class BiometricService {

  constructor(private cryptoService: CryptoService) {}

  /**
   * Checks if biometric hardware is available and if a biometric key is enrolled.
   */
  public async getStatus(): Promise<BiometricStatus> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return {
        available: false,
        enrolled: false,
        reason: 'Biometric unlock is only available on Android native devices.'
      };
    }

    try {
      const res = await VaultSecurity.checkBiometrics();
      return {
        available: res.isAvailable,
        enrolled: res.isEnrolled
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        available: false,
        enrolled: false,
        reason: msg
      };
    }
  }

  /**
   * Enrolls biometric unlock by wrapping the DEK with a hardware-backed Android Keystore key.
   */
  public async enroll(dek: Uint8Array): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return { success: false, error: 'Platform not supported for biometric enrollment' };
    }

    try {
      const tokenB64 = this.cryptoService.bytesToBase64(dek);
      const res = await VaultSecurity.enrollBiometrics({ token: tokenB64 });
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Performs real cryptographic unwrapping of the DEK using Android Keystore and BiometricPrompt.
   */
  public async unlock(): Promise<BiometricUnlockResult> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return { success: false, error: 'Biometric unlock unavailable on current platform' };
    }

    try {
      const res = await VaultSecurity.unlockWithBiometrics();
      if (res.success && res.token) {
        const dek = this.cryptoService.base64ToBytes(res.token);
        return {
          success: true,
          dek
        };
      }

      return {
        success: false,
        invalidated: res.invalidated,
        cancelled: res.cancelled,
        error: res.error || 'Biometric authentication was not completed'
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Disables biometric unlock and purges the hardware key and biometric token.
   */
  public async disable(): Promise<void> {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        await VaultSecurity.disableBiometrics();
      } catch {
        // Silently continue
      }
    }
  }
}
