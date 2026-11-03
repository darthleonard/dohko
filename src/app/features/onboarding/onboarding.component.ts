import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular/lazy';
import { addIcons } from 'ionicons';
import {
  eye,
  eyeOff,
  lockClosed,
  shieldCheckmark,
  warning,
} from 'ionicons/icons';
import { MasterPasswordService } from '../../core/auth/master-password.service';
import { VaultSessionService } from '../../core/auth/vault-session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, TranslatePipe],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css'],
})
export class OnboardingComponent {
  public password = '';
  public confirmPassword = '';
  public showPassword = false;
  public showConfirmPassword = false;
  public isLoading = signal(false);
  public errorMessage = signal('');

  constructor(
    private masterPasswordService: MasterPasswordService,
    private sessionService: VaultSessionService,
    private router: Router,
    private toastCtrl: ToastController,
    private translate: LanguageService,
  ) {
    addIcons({ shieldCheckmark, lockClosed, warning, eye, eyeOff });
  }

  public isFormValid(): boolean {
    return this.password.length >= MasterPasswordService.MIN_PASSWORD_LENGTH;
  }

  public async onCreateVault(): Promise<void> {
    this.errorMessage.set('');

    if (this.password.length < MasterPasswordService.MIN_PASSWORD_LENGTH) {
      this.errorMessage.set(this.translate.instant('ONBOARDING.ERROR_PASSWORD_MIN_LENGTH', {
        minLength: MasterPasswordService.MIN_PASSWORD_LENGTH,
      }));
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage.set(this.translate.instant('COMMON.PASSWORDS_DO_NOT_MATCH'));
      return;
    }

    this.isLoading.set(true);

    try {
      const dek = await this.masterPasswordService.setupVault(this.password);
      await this.sessionService.unlock(dek);

      const toast = await this.toastCtrl.create({
        message: this.translate.instant('ONBOARDING.VAULT_CREATED'),
        duration: 2000,
        color: 'success',
        position: 'bottom',
      });
      await toast.present();

      this.password = '';
      this.confirmPassword = '';
      await this.router.navigate(['/credentials'], { replaceUrl: true });
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : String(err));
      console.error('Error creating vault:', err);
    } finally {
      this.isLoading.set(false);
    }
  }
}
