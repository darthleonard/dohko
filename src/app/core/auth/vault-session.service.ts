import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { CryptoService } from '../crypto/crypto.service';
import { DatabaseService } from '../database/database.service';
import { KeyManagementService } from '../crypto/key-management.service';
import { AutoLockService } from '../security/auto-lock.service';
import { AppPrivacyService } from '../security/app-privacy.service';
import { ClipboardService } from '../security/clipboard.service';

/**
 * VaultSessionService
 *
 * Centralized vault session manager controlling unlock state, cryptographic key lifecycle,
 * and automatic locking.
 *
 * Security Rationale:
 * - Keeps the 256-bit DEK strictly in memory during an active unlocked session.
 * - Explicitly wipes key memory buffers (fill with 0) and closes the encrypted database
 *   immediately upon locking.
 * - Coordinates inactivity monitoring, auto-locking, and privacy concealment.
 * - Maintains a session generation ID to invalidate and discard any pending/stale
 *   asynchronous operations executed prior to locking.
 */
@Injectable({
  providedIn: 'root'
})
export class VaultSessionService {

  private isUnlockedSubject = new BehaviorSubject<boolean>(false);
  public isUnlocked$: Observable<boolean> = this.isUnlockedSubject.asObservable();

  private activeDek: Uint8Array | null = null;
  private sessionGeneration = 0;

  constructor(
    private cryptoService: CryptoService,
    private keyManagement: KeyManagementService,
    private dbService: DatabaseService,
    private autoLock: AutoLockService,
    private appPrivacy: AppPrivacyService,
    private clipboardService: ClipboardService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  public isUnlocked(): boolean {
    return this.isUnlockedSubject.value && this.activeDek !== null;
  }

  /**
   * Returns current session generation token to detect and prevent stale async UI restoration.
   */
  public getSessionGeneration(): number {
    return this.sessionGeneration;
  }

  /**
   * Checks if an async operation started under the given session generation is still valid.
   */
  public isSessionValid(generation: number): boolean {
    return this.isUnlocked() && generation === this.sessionGeneration;
  }

  /**
   * Activates vault session with the verified DEK.
   */
  public async unlock(dek: Uint8Array): Promise<void> {
    this.sessionGeneration++;
    this.activeDek = new Uint8Array(dek);

    // Open encrypted SQLCipher database with hex key derived from DEK
    const sqlCipherKey = this.keyManagement.getSqlCipherKey(this.activeDek);
    await this.dbService.openDatabase(sqlCipherKey);

    this.isUnlockedSubject.next(true);

    // Start auto-lock monitoring
    this.autoLock.startMonitoring(() => this.lock('Inactivity auto-lock triggered'));
  }

  /**
   * Locks the vault immediately, wiping secrets and closing the database.
   */
  public async lock(reason = 'Vault locked'): Promise<void> {
    this.sessionGeneration++;

    // 1. Mark session as locked
    this.isUnlockedSubject.next(false);

    // 2. Stop auto-lock and clear pending clipboard and visibility timers
    this.autoLock.stopMonitoring();
    this.appPrivacy.hideAllPasswords();
    this.clipboardService.cancelPendingClear();

    // 3. Wipe active DEK buffer from memory
    if (this.activeDek) {
      this.cryptoService.wipeBytes(this.activeDek);
      this.activeDek = null;
    }

    // 4. Close database connection
    await this.dbService.closeDatabase();

    // 5. Navigate to unlock screen
    this.ngZone.run(() => {
      this.router.navigate(['/unlock'], { replaceUrl: true });
    });
  }

  /**
   * Returns active DEK only if currently unlocked. Throws if locked.
   */
  public getActiveDek(): Uint8Array {
    if (!this.isUnlocked() || !this.activeDek) {
      throw new Error('Vault is locked. Access to encryption key denied.');
    }
    return this.activeDek;
  }
}
