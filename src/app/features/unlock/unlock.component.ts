import { Component, OnInit, signal } from '@angular/core';
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
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-unlock',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, TranslatePipe],
  templateUrl: './unlock.component.html',
  styleUrls: ['./unlock.component.css'],
})
export class UnlockComponent implements OnInit {
  public password = '';
  public showPassword = false;
  public isLoading = signal(false);
  public errorMessage = signal('');
  public bioStatus = signal<BiometricStatus | null>(null);

  constructor(
    private masterPasswordService: MasterPasswordService,
    private biometricService: BiometricService,
    private sessionService: VaultSessionService,
    private keyManagement: KeyManagementService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private translate: LanguageService,
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
    if (this.bioStatus()?.enrolled) {
      setTimeout(() => {
        this.onUnlockWithBiometrics();
      }, 300);
    }
  }

  private async checkBiometrics(): Promise<void> {
    this.bioStatus.set(await this.biometricService.getStatus());
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

    this.errorMessage.set('');
    this.isLoading.set(true);

    try {
      const dek =
        await this.masterPasswordService.verifyAndUnlock(trimmedPassword);
      this.password = '';

      await this.sessionService.unlock(dek);
      await this.router.navigate(['/credentials'], { replaceUrl: true });
    } catch (err: unknown) {
      this.errorMessage.set(
        err instanceof Error
          ? err.message
          : this.translate.instant('UNLOCK.INCORRECT_PASSWORD'),
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  public async onUnlockWithBiometrics(): Promise<void> {
    this.errorMessage.set('');
    this.isLoading.set(true);

    try {
      const res = await this.biometricService.unlock();
      if (res.success && res.dek) {
        await this.sessionService.unlock(res.dek);
        await this.router.navigate(['/credentials'], { replaceUrl: true });
      } else if (res.invalidated) {
        this.errorMessage.set(
          'Biometric credentials changed on device. Master password required.',
        );
        await this.checkBiometrics();
      } else if (!res.cancelled && res.error) {
        this.errorMessage.set(res.error);
      }
    } catch (err: unknown) {
      this.errorMessage.set(
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  public async onShowRecoveryHelp(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('UNLOCK.RECOVERY_TITLE'),
      subHeader: this.translate.instant('UNLOCK.SECURITY_NOTICE'),
      message: this.translate.instant('UNLOCK.RECOVERY_MESSAGE'),
      buttons: [
        {
          text: this.translate.instant('COMMON.CLOSE'),
          role: 'cancel',
        },
        {
          text: this.translate.instant('UNLOCK.RESET_RESTORE'),
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
      header: this.translate.instant('UNLOCK.ERASE_TITLE'),
      message: this.translate.instant('UNLOCK.ERASE_MESSAGE'),
      buttons: [
        {
          text: this.translate.instant('COMMON.CANCEL'),
          role: 'cancel',
        },
        {
          text: this.translate.instant('UNLOCK.ERASE_VAULT'),
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
