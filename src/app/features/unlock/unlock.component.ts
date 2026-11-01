import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AlertController,
  IonicModule,
  ToastController,
} from '@ionic/angular/lazy';
import { addIcons } from 'ionicons';
import {
  eye,
  eyeOff,
  fingerPrint,
  lockClosed,
  lockOpen,
  trashOutline,
  warning,
} from 'ionicons/icons';
import { MasterPasswordService } from '../../core/auth/master-password.service';
import {
  BiometricService,
  BiometricStatus,
} from '../../core/auth/biometric.service';
import { VaultSessionService } from '../../core/auth/vault-session.service';
import { KeyManagementService } from '../../core/crypto/key-management.service';

@Component({
  selector: 'app-unlock',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './unlock.component.html',
  styleUrls: ['./unlock.component.css'],
})
export class UnlockComponent implements OnInit {
  public password = '';
  public showPassword = false;
  public isLoading = false;
  public errorMessage = '';
  public bioStatus: BiometricStatus | null = null;

  constructor(
    private masterPasswordService: MasterPasswordService,
    private biometricService: BiometricService,
    private sessionService: VaultSessionService,
    private keyManagement: KeyManagementService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {
    addIcons({
      lockClosed,
      lockOpen,
      eye,
      eyeOff,
      fingerPrint,
      warning,
      trashOutline,
    });
  }

  public async ngOnInit(): Promise<void> {
    await this.checkBiometrics();
    if (this.bioStatus?.enrolled) {
      setTimeout(() => {
        this.onUnlockWithBiometrics();
      }, 300);
    }
  }

  private async checkBiometrics(): Promise<void> {
    this.bioStatus = await this.biometricService.getStatus();
  }

  public async onUnlockWithPassword(): Promise<void> {
    if (!this.password) {
      return;
    }

    // Trim surrounding whitespace that may be silently injected by Android IME / autocorrect.
    const trimmedPassword = this.password.trim();
    if (!trimmedPassword) {
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;

    const totalLabel = `[UnlockFlow] Total onUnlockWithPassword`;
    console.time(totalLabel);
    console.log(`[UnlockFlow] Starting master-password unlock flow at ${new Date().toISOString()}`);

    try {
      const stage1 = `[UnlockFlow] Stage 1: MasterPasswordService.verifyAndUnlock`;
      console.time(stage1);
      console.log(`[UnlockFlow] Starting Stage 1: verifyAndUnlock at ${new Date().toISOString()}`);
      let dek: Uint8Array;
      try {
        dek = await this.masterPasswordService.verifyAndUnlock(
          trimmedPassword,
        );
        console.log(`[UnlockFlow] Completed Stage 1: verifyAndUnlock at ${new Date().toISOString()}`);
      } catch (err) {
        console.error(`[UnlockFlow] Error in Stage 1: verifyAndUnlock:`, err);
        throw err;
      } finally {
        console.timeEnd(stage1);
      }

      this.password = '';

      const stage2 = `[UnlockFlow] Stage 2: VaultSessionService.unlock`;
      console.time(stage2);
      console.log(`[UnlockFlow] Starting Stage 2: sessionService.unlock at ${new Date().toISOString()}`);
      try {
        await this.sessionService.unlock(dek);
        console.log(`[UnlockFlow] Completed Stage 2: sessionService.unlock at ${new Date().toISOString()}`);
      } catch (err) {
        console.error(`[UnlockFlow] Error in Stage 2: sessionService.unlock:`, err);
        throw err;
      } finally {
        console.timeEnd(stage2);
      }

      const stage3 = `[UnlockFlow] Stage 3: router.navigate to /credentials`;
      console.time(stage3);
      console.log(`[UnlockFlow] Starting Stage 3: router.navigate at ${new Date().toISOString()}`);
      try {
        await this.router.navigate(['/credentials'], { replaceUrl: true });
        console.log(`[UnlockFlow] Completed Stage 3: router.navigate at ${new Date().toISOString()}`);
      } catch (err) {
        console.error(`[UnlockFlow] Error in Stage 3: router.navigate:`, err);
        throw err;
      } finally {
        console.timeEnd(stage3);
      }
    } catch (err: unknown) {
      this.errorMessage =
        err instanceof Error
          ? err.message
          : 'Unlock failed. Incorrect password.';
      console.error('Unlock error:', err);
    } finally {
      this.isLoading = false;
      console.timeEnd(totalLabel);
      console.log(`[UnlockFlow] Finished master-password unlock flow at ${new Date().toISOString()}`);
    }
  }

  public async onUnlockWithBiometrics(): Promise<void> {
    this.errorMessage = '';
    this.isLoading = true;

    try {
      const res = await this.biometricService.unlock();
      if (res.success && res.dek) {
        await this.sessionService.unlock(res.dek);
        await this.router.navigate(['/credentials'], { replaceUrl: true });
      } else if (res.invalidated) {
        this.errorMessage =
          'Biometric credentials changed on device. Master password required.';
        await this.checkBiometrics();
      } else if (!res.cancelled && res.error) {
        this.errorMessage = res.error;
      }
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      this.isLoading = false;
    }
  }

  public async onShowRecoveryHelp(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Master Password Recovery',
      subHeader: 'Security Architecture Notice',
      message:
        'Because your vault is encrypted with zero-knowledge cryptography (Argon2id + AES-256-GCM), your password cannot be reset or recovered by anyone.\n\nIf you have an exported .vault backup file, you can reset your local vault and restore your credentials with your backup password.',
      buttons: [
        {
          text: 'Close',
          role: 'cancel',
        },
        {
          text: 'Reset Vault & Restore',
          role: 'destructive',
          handler: () => {
            this.confirmVaultReset();
          },
        },
      ],
    });
    await alert.present();
  }

  private async confirmVaultReset(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Erase Local Vault?',
      message:
        'WARNING: This will permanently delete the current encrypted database and keys on this device. Only proceed if you have an encrypted backup file (.vault).',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Erase Vault',
          role: 'destructive',
          handler: async () => {
            await this.keyManagement.clearMetadata();
            await this.biometricService.disable();
            await this.sessionService.lock('Vault reset');
            await this.router.navigate(['/onboarding'], { replaceUrl: true });
          },
        },
      ],
    });
    await alert.present();
  }
}
