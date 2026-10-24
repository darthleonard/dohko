import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, IonicModule, ToastController } from '@ionic/angular/lazy';
import { addIcons } from 'ionicons';
import { eye, eyeOff, fingerPrint, lockClosed, lockOpen, trashOutline, warning } from 'ionicons/icons';
import { MasterPasswordService } from '../../core/auth/master-password.service';
import { BiometricService, BiometricStatus } from '../../core/auth/biometric.service';
import { VaultSessionService } from '../../core/auth/vault-session.service';
import { KeyManagementService } from '../../core/crypto/key-management.service';

@Component({
  selector: 'app-unlock',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-title>Dohko Vault</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="unlock-container">
        <div class="header-icon ion-text-center">
          <ion-icon name="lock-closed" color="primary" class="hero-icon"></ion-icon>
          <h2>Vault Locked</h2>
          <p class="subtitle">Enter your master password to decrypt</p>
        </div>

        <ion-card>
          <ion-card-header>
            <ion-card-title>Unlock Vault</ion-card-title>
            <ion-card-subtitle>All data remains encrypted at rest</ion-card-subtitle>
          </ion-card-header>

          <ion-card-content>
            <form (ngSubmit)="onUnlockWithPassword()">
              <ion-item class="ion-margin-top">
                <ion-input
                  [type]="showPassword ? 'text' : 'password'"
                  label="Master Password"
                  labelPlacement="floating"
                  [(ngModel)]="password"
                  name="password"
                  required
                  placeholder="Enter master password"
                  [disabled]="isLoading"
                >
                  <ion-button
                    fill="clear"
                    slot="end"
                    type="button"
                    (click)="showPassword = !showPassword"
                    aria-label="Toggle password visibility"
                  >
                    <ion-icon [name]="showPassword ? 'eye-off' : 'eye'" slot="icon-only"></ion-icon>
                  </ion-button>
                </ion-input>
              </ion-item>

              <div *ngIf="errorMessage" class="error-text ion-margin-top">
                <ion-text color="danger">{{ errorMessage }}</ion-text>
              </div>

              <div *ngIf="isLoading" class="loading-state ion-margin-top ion-text-center">
                <ion-spinner name="crescent" color="primary"></ion-spinner>
                <p>Verifying master key & decrypting vault...</p>
                <ion-progress-bar type="indeterminate" color="primary"></ion-progress-bar>
              </div>

              <ion-button
                expand="block"
                type="submit"
                class="ion-margin-top"
                [disabled]="isLoading || !password"
              >
                <ion-icon name="lock-open" slot="start"></ion-icon>
                Unlock
              </ion-button>

              <div *ngIf="bioStatus?.enrolled" class="ion-margin-top">
                <ion-button
                  expand="block"
                  fill="outline"
                  type="button"
                  color="secondary"
                  (click)="onUnlockWithBiometrics()"
                  [disabled]="isLoading"
                >
                  <ion-icon name="finger-print" slot="start"></ion-icon>
                  Unlock with Biometrics
                </ion-button>
              </div>
            </form>

            <div class="recovery-section ion-margin-top ion-text-center">
              <ion-button fill="clear" size="small" color="medium" (click)="onShowRecoveryHelp()">
                Forgot Password?
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  `,
  styles: [`
    .unlock-container {
      max-width: 500px;
      margin: 0 auto;
      padding-top: 30px;
    }
    .header-icon {
      margin-bottom: 24px;
    }
    .hero-icon {
      font-size: 72px;
      margin-bottom: 8px;
    }
    .subtitle {
      color: var(--ion-color-medium);
      margin-top: 4px;
    }
    .error-text {
      padding: 8px 12px;
      background: var(--ion-color-danger-tint, #ffebee);
      border-radius: 6px;
      font-size: 0.9rem;
    }
    .loading-state p {
      font-size: 0.85rem;
      color: var(--ion-color-medium);
      margin-top: 8px;
    }
    .recovery-section {
      margin-top: 20px;
      border-top: 1px solid var(--ion-color-light, #eee);
      padding-top: 10px;
    }
  `]
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
    private toastCtrl: ToastController
  ) {
    addIcons({ lockClosed, lockOpen, eye, eyeOff, fingerPrint, warning, trashOutline });
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
      const dek = await this.masterPasswordService.verifyAndUnlock(this.password);
      this.password = '';
      await this.sessionService.unlock(dek);
      await this.router.navigate(['/credentials'], { replaceUrl: true });
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : 'Unlock failed. Incorrect password.';
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
        this.errorMessage = 'Biometric credentials changed on device. Master password required.';
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
      message: 'Because your vault is encrypted with zero-knowledge cryptography (Argon2id + AES-256-GCM), your password cannot be reset or recovered by anyone.\n\nIf you have an exported .vault backup file, you can reset your local vault and restore your credentials with your backup password.',
      buttons: [
        {
          text: 'Close',
          role: 'cancel'
        },
        {
          text: 'Reset Vault & Restore',
          role: 'destructive',
          handler: () => {
            this.confirmVaultReset();
          }
        }
      ]
    });
    await alert.present();
  }

  private async confirmVaultReset(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Erase Local Vault?',
      message: 'WARNING: This will permanently delete the current encrypted database and keys on this device. Only proceed if you have an encrypted backup file (.vault).',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Erase Vault',
          role: 'destructive',
          handler: async () => {
            await this.keyManagement.clearMetadata();
            await this.biometricService.disable();
            await this.sessionService.lock('Vault reset');
            await this.router.navigate(['/onboarding'], { replaceUrl: true });
          }
        }
      ]
    });
    await alert.present();
  }
}
