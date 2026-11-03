import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { CryptoService } from '../crypto/crypto.service';
import { LanguageService } from '../i18n/language.service';

interface VaultSecurityPluginInterface {
  setSecure(options: { enabled: boolean }): Promise<{ secure: boolean }>;
  checkBiometrics(): Promise<{ isAvailable: boolean; isEnrolled: boolean; status: number }>;
  enrollBiometrics(options: {
    token: string;
    promptTitle: string;
    promptSubtitle: string;
    negativeButtonText: string;
  }): Promise<{ success: boolean; cancelled?: boolean; errorCode?: number }>;
  unlockWithBiometrics(options: {
    promptTitle: string;
    promptSubtitle: string;
    negativeButtonText: string;
  }): Promise<{
    success: boolean;
    token?: string;
    invalidated?: boolean;
    cancelled?: boolean;
    errorCode?: number;
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

  constructor(
    private cryptoService: CryptoService,
    private languageService: LanguageService,
  ) {}

  /**
   * Checks if biometric hardware is available and if a biometric key is enrolled.
   */
  public async getStatus(): Promise<BiometricStatus> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return {
        available: false,
        enrolled: false,
        reason: this.languageService.instant('BIOMETRIC.ANDROID_ONLY')
      };
    }

    try {
      const res = await VaultSecurity.checkBiometrics();
      return {
        available: res.isAvailable,
        enrolled: res.isEnrolled
      };
    } catch (err: unknown) {
      return {
        available: false,
        enrolled: false,
        reason: this.languageService.instant('BIOMETRIC.STATUS_FAILED')
      };
    }
  }

  /**
   * Enrolls biometric unlock by wrapping the DEK with a hardware-backed Android Keystore key.
   */
  public async enroll(dek: Uint8Array): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return {
        success: false,
        error: this.languageService.instant('BIOMETRIC.ANDROID_ONLY'),
      };
    }

    try {
      const tokenB64 = this.cryptoService.bytesToBase64(dek);
      const res = await VaultSecurity.enrollBiometrics({
        token: tokenB64,
        promptTitle: this.languageService.instant('BIOMETRIC.ENROLL_TITLE'),
        promptSubtitle: this.languageService.instant('BIOMETRIC.ENROLL_SUBTITLE'),
        negativeButtonText: this.languageService.instant('COMMON.CANCEL'),
      });
      return {
        success: res.success,
        cancelled: res.cancelled,
        error: res.errorCode === undefined
          ? undefined
          : this.languageService.instant(this.getAuthenticationErrorKey(res.errorCode)),
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: this.languageService.instant('BIOMETRIC.ENROLL_FAILED'),
      };
    }
  }

  /**
   * Performs real cryptographic unwrapping of the DEK using Android Keystore and BiometricPrompt.
   */
  public async unlock(): Promise<BiometricUnlockResult> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return {
        success: false,
        error: this.languageService.instant('BIOMETRIC.ANDROID_ONLY'),
      };
    }

    try {
      const res = await VaultSecurity.unlockWithBiometrics({
        promptTitle: this.languageService.instant('BIOMETRIC.UNLOCK_TITLE'),
        promptSubtitle: this.languageService.instant('BIOMETRIC.UNLOCK_SUBTITLE'),
        negativeButtonText: this.languageService.instant('BIOMETRIC.USE_MASTER_PASSWORD'),
      });
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
        error: this.languageService.instant(
          res.invalidated
            ? 'BIOMETRIC.CREDENTIALS_CHANGED'
            : res.errorCode === undefined
              ? 'BIOMETRIC.AUTHENTICATION_FAILED'
              : this.getAuthenticationErrorKey(res.errorCode),
        ),
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: this.languageService.instant('BIOMETRIC.UNLOCK_FAILED'),
      };
    }
  }

  private getAuthenticationErrorKey(errorCode: number): string {
    switch (errorCode) {
      case -1:
        return 'BIOMETRIC.NOT_ENROLLED';
      case -2:
        return 'BIOMETRIC.PAYLOAD_CORRUPT';
      case -3:
        return 'BIOMETRIC.KEY_MISSING';
      case -4:
        return 'BIOMETRIC.CREDENTIALS_CHANGED';
      case 7:
      case 9:
        return 'BIOMETRIC.AUTHENTICATION_LOCKED';
      case 1:
      case 12:
        return 'BIOMETRIC.HARDWARE_UNAVAILABLE';
      case 11:
        return 'BIOMETRIC.NOT_ENROLLED';
      default:
        return 'BIOMETRIC.AUTHENTICATION_FAILED';
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
