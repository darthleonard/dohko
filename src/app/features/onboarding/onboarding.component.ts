import { Component } from '@angular/core';
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

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css'],
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
    private toastCtrl: ToastController,
  ) {
    addIcons({ shieldCheckmark, lockClosed, warning, eye, eyeOff });
  }

  public isFormValid(): boolean {
    return this.password.length >= MasterPasswordService.MIN_PASSWORD_LENGTH;
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
        position: 'bottom',
      });
      await toast.present();

      this.password = '';
      this.confirmPassword = '';
      await this.router.navigate(['/credentials'], { replaceUrl: true });
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Error creating vault:', err);
    } finally {
      this.isLoading = false;
    }
  }
}
