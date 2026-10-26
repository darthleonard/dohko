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

    this.errorMessage = '';
    this.isLoading = true;

    try {
      const dek = await this.masterPasswordService.verifyAndUnlock(
        this.password,
      );
      this.password = '';
      await this.sessionService.unlock(dek);
      await this.router.navigate(['/credentials'], { replaceUrl: true });
    } catch (err: unknown) {
      this.errorMessage =
        err instanceof Error
          ? err.message
          : 'Unlock failed. Incorrect password.';
      console.error('Unlock error:', err);
    } finally {
      this.isLoading = false;
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
