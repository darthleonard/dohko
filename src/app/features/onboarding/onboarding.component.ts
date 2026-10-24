import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular/lazy';
import { addIcons } from 'ionicons';
import { eye, eyeOff, lockClosed, shieldCheckmark, warning } from 'ionicons/icons';
import { MasterPasswordService } from '../../core/auth/master-password.service';
import { VaultSessionService } from '../../core/auth/vault-session.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-title>Dohko Password Manager</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="onboarding-container">
        <div class="header-icon ion-text-center">
          <ion-icon name="shield-checkmark" color="primary" class="hero-icon"></ion-icon>
          <h2>Welcome to Dohko</h2>
          <p class="subtitle">Secure, Offline-First Password Vault</p>
        </div>

        <ion-card>
          <ion-card-header>
            <ion-card-title>Create Master Password</ion-card-title>
            <ion-card-subtitle>Protect your local encrypted database</ion-card-subtitle>
          </ion-card-header>

          <ion-card-content>
            <div class="security-notice">
              <ion-icon name="warning" style="color: #856404"></ion-icon>
              <div>
                <strong>Important:</strong> Your master password encrypts your vault with Argon2id and AES-256-GCM.
                It is never stored or transmitted. If lost, your vault <em>cannot</em> be recovered without an encrypted backup.
              </div>
            </div>

            <form (ngSubmit)="onCreateVault()" #vaultForm="ngForm">
              <ion-item class="ion-margin-top">
                <ion-input
                  [type]="showPassword ? 'text' : 'password'"
                  label="Master Password"
                  labelPlacement="floating"
                  [(ngModel)]="password"
                  name="password"
                  required
                  minlength="8"
                  placeholder="Minimum 8 characters"
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

              <ion-item class="ion-margin-top">
                <ion-input
                  [type]="showConfirmPassword ? 'text' : 'password'"
                  label="Confirm Master Password"
                  labelPlacement="floating"
                  [(ngModel)]="confirmPassword"
                  name="confirmPassword"
                  required
                  placeholder="Re-enter master password"
                  [disabled]="isLoading"
                >
                  <ion-button
                    fill="clear"
                    slot="end"
                    type="button"
                    (click)="showConfirmPassword = !showConfirmPassword"
                    aria-label="Toggle confirm password visibility"
                  >
                    <ion-icon [name]="showConfirmPassword ? 'eye-off' : 'eye'" slot="icon-only"></ion-icon>
                  </ion-button>
                </ion-input>
              </ion-item>

              <div *ngIf="errorMessage" class="error-text ion-margin-top">
                <ion-text color="danger">{{ errorMessage }}</ion-text>
              </div>

              <div *ngIf="isLoading" class="loading-state ion-margin-top ion-text-center">
                <ion-spinner name="crescent" color="primary"></ion-spinner>
                <p>Deriving Argon2id keys & initializing encrypted SQLCipher database...</p>
                <ion-progress-bar type="indeterminate" color="primary"></ion-progress-bar>
              </div>

              <ion-button
                expand="block"
                type="submit"
                class="ion-margin-top"
                [disabled]="isLoading || !isFormValid()"
              >
                <ion-icon name="lock-closed" slot="start"></ion-icon>
                Create Encrypted Vault
              </ion-button>
            </form>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  `,
  styles: [`
    .onboarding-container {
      max-width: 500px;
      margin: 0 auto;
      padding-top: 20px;
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
    .security-notice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: #fff3cd;
      color: #212529;
      border: 1px solid #ffc107;
      padding: 12px;
      border-radius: 8px;
      font-size: 0.9rem;
      line-height: 1.4;
      margin-bottom: 16px;
    }
    .security-notice ion-icon {
      font-size: 24px;
      flex-shrink: 0;
      margin-top: 2px;
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
  `]
})
export class OnboardingComponent {

  public password = '';
  public confirmPassword = '';
  public showPassword = false;
  public showConfirmPassword = false;
  public isLoading = false;
  public errorMessage = '';

  constructor(
    private masterPasswordService: MasterPasswordService,
    private sessionService: VaultSessionService,
    private router: Router,
    private toastCtrl: ToastController
  ) {
    addIcons({ shieldCheckmark, lockClosed, warning, eye, eyeOff });
  }

  public isFormValid(): boolean {
    return (
      this.password.length >= MasterPasswordService.MIN_PASSWORD_LENGTH &&
      this.password === this.confirmPassword
    );
  }

  public async onCreateVault(): Promise<void> {
    this.errorMessage = '';

    if (this.password.length < MasterPasswordService.MIN_PASSWORD_LENGTH) {
      this.errorMessage = `Master password must be at least ${MasterPasswordService.MIN_PASSWORD_LENGTH} characters.`;
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.isLoading = true;

    try {
      const dek = await this.masterPasswordService.setupVault(this.password);
      await this.sessionService.unlock(dek);

      const toast = await this.toastCtrl.create({
        message: 'Vault created successfully!',
        duration: 2000,
        color: 'success',
        position: 'bottom'
      });
      await toast.present();

      this.password = '';
      this.confirmPassword = '';
      await this.router.navigate(['/credentials'], { replaceUrl: true });

    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      this.isLoading = false;
    }
  }
}
