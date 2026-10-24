import { Injectable, NgZone } from '@angular/core';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * AppPrivacyService
 *
 * Coordinates:
 * - Immediate visual concealment overlay when app enters background
 * - Centralized password visibility manager with automatic hiding timers
 * - Cancels password visibility timers when screen navigates or app is backgrounded
 */
@Injectable({
  providedIn: 'root'
})
export class AppPrivacyService {

  public static readonly DEFAULT_VISIBILITY_TIMEOUT_SECONDS = 30;
  private static readonly PREF_VISIBILITY_TIMEOUT = 'dohko_visibility_timeout';

  // Privacy overlay state (true when app is in background or obscured)
  private isObscuredSubject = new BehaviorSubject<boolean>(false);
  public isObscured$: Observable<boolean> = this.isObscuredSubject.asObservable();

  // Active revealed password identifier (credential ID)
  private revealedCredentialIdSubject = new BehaviorSubject<string | null>(null);
  public revealedCredentialId$: Observable<string | null> = this.revealedCredentialIdSubject.asObservable();

  private visibilityTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private ngZone: NgZone) {
    this.initBackgroundListener();
  }

  private initBackgroundListener(): void {
    App.addListener('appStateChange', (state) => {
      this.ngZone.run(() => {
        if (!state.isActive) {
          // Immediately obscure screen
          this.isObscuredSubject.next(true);
          // Immediately hide any temporarily revealed passwords
          this.hideAllPasswords();
        } else {
          this.isObscuredSubject.next(false);
        }
      });
    });
  }

  /**
   * Temporarily reveals a password for the specified credential ID, starting an auto-hide countdown.
   */
  public async revealPassword(credentialId: string): Promise<void> {
    this.hideAllPasswords();

    this.revealedCredentialIdSubject.next(credentialId);
    const timeoutSeconds = await this.getVisibilityTimeout();

    if (timeoutSeconds > 0) {
      this.visibilityTimer = setTimeout(() => {
        this.ngZone.run(() => {
          if (this.revealedCredentialIdSubject.value === credentialId) {
            this.hideAllPasswords();
          }
        });
      }, timeoutSeconds * 1000);
    }
  }

  /**
   * Hides any currently revealed password and clears timers.
   */
  public hideAllPasswords(): void {
    if (this.visibilityTimer) {
      clearTimeout(this.visibilityTimer);
      this.visibilityTimer = null;
    }
    this.revealedCredentialIdSubject.next(null);
  }

  /**
   * Returns whether a specific credential's password is currently revealed.
   */
  public isPasswordRevealed(credentialId: string): boolean {
    return this.revealedCredentialIdSubject.value === credentialId;
  }

  /**
   * Get configured password visibility timeout in seconds.
   */
  public async getVisibilityTimeout(): Promise<number> {
    try {
      const { value } = await Preferences.get({ key: AppPrivacyService.PREF_VISIBILITY_TIMEOUT });
      return value !== null ? parseInt(value, 10) : AppPrivacyService.DEFAULT_VISIBILITY_TIMEOUT_SECONDS;
    } catch {
      return AppPrivacyService.DEFAULT_VISIBILITY_TIMEOUT_SECONDS;
    }
  }

  /**
   * Set password visibility timeout in seconds.
   */
  public async setVisibilityTimeout(seconds: number): Promise<void> {
    await Preferences.set({
      key: AppPrivacyService.PREF_VISIBILITY_TIMEOUT,
      value: seconds.toString()
    });
  }
}
