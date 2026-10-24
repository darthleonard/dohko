import { Injectable } from '@angular/core';
import { Clipboard } from '@capacitor/clipboard';
import { Preferences } from '@capacitor/preferences';

/**
 * ClipboardService
 *
 * Provides safe clipboard copying and conditional clearing.
 *
 * Security Rationale:
 * - Passwords copied to the clipboard are subject to a time-based clearing countdown.
 * - When clearing, the service checks the current clipboard content.
 * - It clears the clipboard ONLY IF the current content strictly matches the value
 *   written by this application, ensuring we never overwrite text copied by another
 *   app or user in the interim.
 * - Never logs or exposes password content in toast alerts or system logs.
 */
@Injectable({
  providedIn: 'root'
})
export class ClipboardService {

  public static readonly DEFAULT_TIMEOUT_SECONDS = 30;
  private static readonly PREF_CLIPBOARD_TIMEOUT = 'dohko_clipboard_timeout';

  private lastCopiedSecret: string | null = null;
  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Copies a sensitive string to the system clipboard and schedules conditional clearing.
   */
  public async copySensitive(value: string): Promise<void> {
    if (!value) {
      return;
    }

    // Cancel existing timer if any
    this.cancelPendingClear();

    await Clipboard.write({ string: value });
    this.lastCopiedSecret = value;

    const timeoutSeconds = await this.getTimeout();
    if (timeoutSeconds > 0) {
      this.clearTimer = setTimeout(() => {
        this.performConditionalClear(value);
      }, timeoutSeconds * 1000);
    }
  }

  /**
   * Clears the clipboard only if it still holds the exact value written by the app.
   */
  private async performConditionalClear(expectedValue: string): Promise<void> {
    try {
      const current = await Clipboard.read();
      if (current && current.value === expectedValue) {
        await Clipboard.write({ string: '' });
      }
    } catch {
      // In case clipboard read is restricted on specific platform versions
    } finally {
      if (this.lastCopiedSecret === expectedValue) {
        this.lastCopiedSecret = null;
      }
    }
  }

  /**
   * Cancels any pending clear timer (e.g. on manual vault lock).
   */
  public cancelPendingClear(): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
    this.lastCopiedSecret = null;
  }

  /**
   * Get configured timeout in seconds.
   */
  public async getTimeout(): Promise<number> {
    try {
      const { value } = await Preferences.get({ key: ClipboardService.PREF_CLIPBOARD_TIMEOUT });
      return value !== null ? parseInt(value, 10) : ClipboardService.DEFAULT_TIMEOUT_SECONDS;
    } catch {
      return ClipboardService.DEFAULT_TIMEOUT_SECONDS;
    }
  }

  /**
   * Set configured timeout in seconds (0 = never clear).
   */
  public async setTimeout(seconds: number): Promise<void> {
    await Preferences.set({
      key: ClipboardService.PREF_CLIPBOARD_TIMEOUT,
      value: seconds.toString()
    });
  }
}
