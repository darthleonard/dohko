import { Injectable, NgZone } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export type AutoLockTimeout = 60 | 120 | 300 | 600 | 0; // seconds (0 = never)

/**
 * AutoLockService
 *
 * Tracks user activity and triggers automatic locking after the configured inactivity threshold.
 */
@Injectable({
  providedIn: 'root'
})
export class AutoLockService {

  public static readonly DEFAULT_TIMEOUT_SECONDS = 300; // 5 minutes
  private static readonly PREF_AUTOLOCK_TIMEOUT = 'dohko_autolock_timeout';

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private onLockCallback: (() => Promise<void>) | null = null;
  private isMonitoring = false;

  constructor(private ngZone: NgZone) {}

  /**
   * Initializes activity listeners and registers the lock callback.
   */
  public startMonitoring(onLock: () => Promise<void>): void {
    this.onLockCallback = onLock;
    if (!this.isMonitoring) {
      this.isMonitoring = true;
      this.attachListeners();
    }
    this.resetTimer();
  }

  /**
   * Stops activity monitoring (called on vault lock).
   */
  public stopMonitoring(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Resets the inactivity timer upon detected user interaction.
   */
  public async resetTimer(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    const timeoutSeconds = await this.getTimeout();
    if (timeoutSeconds > 0) {
      this.idleTimer = setTimeout(() => {
        this.ngZone.run(async () => {
          if (this.onLockCallback) {
            await this.onLockCallback();
          }
        });
      }, timeoutSeconds * 1000);
    }
  }

  /**
   * Returns configured timeout in seconds.
   */
  public async getTimeout(): Promise<number> {
    try {
      const { value } = await Preferences.get({ key: AutoLockService.PREF_AUTOLOCK_TIMEOUT });
      return value !== null ? parseInt(value, 10) : AutoLockService.DEFAULT_TIMEOUT_SECONDS;
    } catch {
      return AutoLockService.DEFAULT_TIMEOUT_SECONDS;
    }
  }

  /**
   * Sets auto-lock timeout in seconds.
   */
  public async setTimeout(seconds: number): Promise<void> {
    await Preferences.set({
      key: AutoLockService.PREF_AUTOLOCK_TIMEOUT,
      value: seconds.toString()
    });
    this.resetTimer();
  }

  private attachListeners(): void {
    const events = ['touchstart', 'touchmove', 'mousedown', 'keydown', 'scroll'];
    events.forEach(eventName => {
      window.addEventListener(eventName, () => this.resetTimer(), { passive: true });
    });
  }
}
