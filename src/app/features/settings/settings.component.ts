import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AlertController,
  IonicModule,
  LoadingController,
  ToastController
} from '@ionic/angular/lazy';
import { addIcons } from 'ionicons';
import {
  cloudDownloadOutline,
  cloudUploadOutline,
  fingerPrint,
  informationCircleOutline,
  keyOutline,
  lockClosed,
  shieldCheckmarkOutline,
  timerOutline
} from 'ionicons/icons';
import { BiometricService, BiometricStatus } from '../../core/auth/biometric.service';
import { MasterPasswordService } from '../../core/auth/master-password.service';
import { VaultSessionService } from '../../core/auth/vault-session.service';
import { AutoLockService } from '../../core/security/auto-lock.service';
import { AppPrivacyService } from '../../core/security/app-privacy.service';
import { ClipboardService } from '../../core/security/clipboard.service';
import { BackupService } from '../../core/backup/backup.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/credentials"></ion-back-button>
        </ion-buttons>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-list lines="inset">
        <!-- Security & Auto-Lock -->
        <ion-list-header>
          <ion-label>Security & Timers</ion-label>
        </ion-list-header>

        <!-- Biometric Unlock Toggle -->
        <ion-item>
          <ion-icon name="finger-print" slot="start" color="primary"></ion-icon>
          <ion-label>
            <h3>Biometric Unlock</h3>
            <p>Android Keystore hardware-backed unlock</p>
          </ion-label>
          <ion-toggle
            [checked]="isBiometricEnrolled"
            [disabled]="!isBiometricAvailable"
            (ionChange)="onToggleBiometrics($event)"
          ></ion-toggle>
        </ion-item>
        <ion-note *ngIf="!isBiometricAvailable" color="medium" class="setting-note ion-padding-start">
          Biometrics not available or not enrolled on this device.
        </ion-note>

        <!-- Inactivity Auto-Lock -->
        <ion-item>
          <ion-icon name="timer-outline" slot="start" color="primary"></ion-icon>
          <ion-label>
            <h3>Vault Auto-Lock</h3>
            <p>Lock after inactivity</p>
          </ion-label>
          <ion-select [(ngModel)]="autoLockTimeout" (ionChange)="onAutoLockChange()">
            <ion-select-option [value]="60">1 minute</ion-select-option>
            <ion-select-option [value]="120">2 minutes</ion-select-option>
            <ion-select-option [value]="300">5 minutes</ion-select-option>
            <ion-select-option [value]="600">10 minutes</ion-select-option>
            <ion-select-option [value]="0">Never</ion-select-option>
          </ion-select>
        </ion-item>

        <!-- Password Visibility Timeout -->
        <ion-item>
          <ion-icon name="timer-outline" slot="start" color="primary"></ion-icon>
          <ion-label>
            <h3>Password Visibility</h3>
            <p>Auto-hide revealed passwords</p>
          </ion-label>
          <ion-select [(ngModel)]="visibilityTimeout" (ionChange)="onVisibilityTimeoutChange()">
            <ion-select-option [value]="10">10 seconds</ion-select-option>
            <ion-select-option [value]="30">30 seconds</ion-select-option>
            <ion-select-option [value]="60">60 seconds</ion-select-option>
          </ion-select>
        </ion-item>

        <!-- Clipboard Auto-Clear -->
        <ion-item>
          <ion-icon name="timer-outline" slot="start" color="primary"></ion-icon>
          <ion-label>
            <h3>Clipboard Auto-Clear</h3>
            <p>Clear copied password</p>
          </ion-label>
          <ion-select [(ngModel)]="clipboardTimeout" (ionChange)="onClipboardTimeoutChange()">
            <ion-select-option [value]="15">15 seconds</ion-select-option>
            <ion-select-option [value]="30">30 seconds</ion-select-option>
            <ion-select-option [value]="60">60 seconds</ion-select-option>
            <ion-select-option [value]="0">Never</ion-select-option>
          </ion-select>
        </ion-item>

        <!-- Master Password Management -->
        <ion-list-header class="ion-margin-top">
          <ion-label>Vault Management</ion-label>
        </ion-list-header>

        <ion-item button (click)="onChangeMasterPassword()">
          <ion-icon name="key-outline" slot="start" color="primary"></ion-icon>
          <ion-label>
            <h3>Change Master Password</h3>
            <p>Re-encrypt vault key with new password</p>
          </ion-label>
        </ion-item>

        <!-- Encrypted Backup Export -->
        <ion-item button (click)="onExportBackup()">
          <ion-icon name="cloud-upload-outline" slot="start" color="secondary"></ion-icon>
          <ion-label>
            <h3>Export Encrypted Backup</h3>
            <p>Save password-protected .vault file</p>
          </ion-label>
        </ion-item>

        <!-- Encrypted Backup Import -->
        <ion-item button (click)="onImportBackup()">
          <ion-icon name="cloud-download-outline" slot="start" color="secondary"></ion-icon>
          <ion-label>
            <h3>Import Encrypted Backup</h3>
            <p>Full transactional restore from .vault file</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <!-- Hidden file input for backup restore -->
      <input
        type="file"
        #fileInput
        style="display: none"
        accept=".vault,application/json"
        (change)="onFileSelected($event)"
      />

      <!-- Security Architecture Info Card -->
      <ion-card class="ion-margin-top">
        <ion-card-header>
          <ion-card-title>
            <ion-icon name="shield-checkmark-outline" color="success"></ion-icon>
            Security & Privacy
          </ion-card-title>
          <ion-card-subtitle>Zero-Knowledge, Offline Architecture</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <p>• <strong>Local Database:</strong> SQLite encrypted with SQLCipher (AES-256).</p>
          <p>• <strong>Key Derivation:</strong> Argon2id (64 MiB memory, 3 passes, 16-byte random salt).</p>
          <p>• <strong>Key Hierarchy:</strong> 256-bit DEK wrapped via AES-256-GCM.</p>
          <p>• <strong>Biometrics:</strong> Real Android Keystore hardware-backed encryption key.</p>
          <p>• <strong>Screen Security:</strong> Android FLAG_SECURE blocks screenshots and task switcher previews.</p>
          <p>• <strong>Strictly Offline:</strong> No network permissions, zero telemetry, zero servers.</p>
        </ion-card-content>
      </ion-card>

      <!-- Immediate Lock Button -->
      <div class="ion-margin-top ion-padding">
        <ion-button expand="block" color="danger" fill="outline" (click)="onLockVaultNow()">
          <ion-icon name="lock-closed" slot="start"></ion-icon>
          Lock Vault Now
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .setting-note {
      font-size: 0.8rem;
      margin-bottom: 8px;
      display: block;
    }
  `]
})
export class SettingsComponent implements OnInit {

  public isBiometricAvailable = false;
  public isBiometricEnrolled = false;
  public autoLockTimeout = 300;
  public visibilityTimeout = 30;
  public clipboardTimeout = 30;

  constructor(
    private biometricService: BiometricService,
    private masterPasswordService: MasterPasswordService,
    private sessionService: VaultSessionService,
    private autoLockService: AutoLockService,
    private appPrivacyService: AppPrivacyService,
    private clipboardService: ClipboardService,
    private backupService: BackupService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private router: Router
  ) {
    addIcons({
      fingerPrint,
      timerOutline,
      keyOutline,
      cloudUploadOutline,
      cloudDownloadOutline,
      shieldCheckmarkOutline,
      lockClosed,
      informationCircleOutline
    });
  }

  public async ngOnInit(): Promise<void> {
    await this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    const bio = await this.biometricService.getStatus();
    this.isBiometricAvailable = bio.available;
    this.isBiometricEnrolled = bio.enrolled;

    this.autoLockTimeout = await this.autoLockService.getTimeout();
    this.visibilityTimeout = await this.appPrivacyService.getVisibilityTimeout();
    this.clipboardTimeout = await this.clipboardService.getTimeout();
  }

  public async onToggleBiometrics(event: any): Promise<void> {
    const enable = event.detail.checked;

    if (enable && !this.isBiometricEnrolled) {
      const alert = await this.alertCtrl.create({
        header: 'Enable Biometric Unlock',
        message: 'Enter your master password to verify and enroll hardware-backed biometrics.',
        inputs: [
          {
            name: 'password',
            type: 'password',
            placeholder: 'Master Password'
          }
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              this.isBiometricEnrolled = false;
            }
          },
          {
            text: 'Verify & Enroll',
            handler: async (data: { password?: string }) => {
              if (!data.password) {
                this.isBiometricEnrolled = false;
                return;
              }
              await this.performBiometricEnrollment(data.password);
            }
          }
        ]
      });
      await alert.present();

    } else if (!enable && this.isBiometricEnrolled) {
      await this.biometricService.disable();
      this.isBiometricEnrolled = false;
      const toast = await this.toastCtrl.create({
        message: 'Biometric unlock disabled',
        duration: 2000,
        position: 'bottom'
      });
      await toast.present();
    }
  }

  private async performBiometricEnrollment(password: string): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Verifying master key...' });
    await loading.present();

    try {
      const dek = await this.masterPasswordService.verifyAndUnlock(password);
      await loading.dismiss();

      const result = await this.biometricService.enroll(dek);
      if (result.success) {
        this.isBiometricEnrolled = true;
        const toast = await this.toastCtrl.create({
          message: 'Biometric unlock enabled successfully!',
          duration: 2500,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
      } else {
        this.isBiometricEnrolled = false;
        if (!result.cancelled && result.error) {
          const toast = await this.toastCtrl.create({
            message: result.error,
            duration: 3000,
            color: 'danger',
            position: 'bottom'
          });
          await toast.present();
        }
      }
    } catch (err: unknown) {
      await loading.dismiss();
      this.isBiometricEnrolled = false;
      const msg = err instanceof Error ? err.message : String(err);
      const toast = await this.toastCtrl.create({
        message: msg,
        duration: 3000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  }

  public async onAutoLockChange(): Promise<void> {
    await this.autoLockService.setTimeout(this.autoLockTimeout);
  }

  public async onVisibilityTimeoutChange(): Promise<void> {
    await this.appPrivacyService.setVisibilityTimeout(this.visibilityTimeout);
  }

  public async onClipboardTimeoutChange(): Promise<void> {
    await this.clipboardService.setTimeout(this.clipboardTimeout);
  }

  public async onChangeMasterPassword(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Change Master Password',
      subHeader: 'Re-encrypts vault master key',
      inputs: [
        {
          name: 'currentPassword',
          type: 'password',
          placeholder: 'Current Master Password'
        },
        {
          name: 'newPassword',
          type: 'password',
          placeholder: 'New Master Password (min 8 chars)'
        },
        {
          name: 'confirmNewPassword',
          type: 'password',
          placeholder: 'Confirm New Master Password'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Change Password',
          handler: async (data: { currentPassword?: string; newPassword?: string; confirmNewPassword?: string }) => {
            if (!data.currentPassword || !data.newPassword || !data.confirmNewPassword) {
              this.showToast('All password fields are required.', 'danger');
              return false;
            }
            if (data.newPassword.length < 8) {
              this.showToast('New password must be at least 8 characters.', 'danger');
              return false;
            }
            if (data.newPassword !== data.confirmNewPassword) {
              this.showToast('New passwords do not match.', 'danger');
              return false;
            }
            await this.performPasswordChange(data.currentPassword, data.newPassword);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async performPasswordChange(curr: string, next: string): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Deriving new Argon2id key...' });
    await loading.present();

    try {
      const activeDek = this.sessionService.getActiveDek();
      await this.masterPasswordService.changeMasterPassword(curr, next, activeDek);
      await loading.dismiss();

      this.showToast('Master password changed successfully!', 'success');
    } catch (err: unknown) {
      await loading.dismiss();
      const msg = err instanceof Error ? err.message : String(err);
      this.showToast(msg, 'danger');
    }
  }

  public async onExportBackup(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Export Encrypted Backup',
      subHeader: 'Create a standalone .vault file',
      message: 'Choose a dedicated backup password to encrypt this file. You will need this password to restore your vault.',
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: 'Backup Password (min 8 chars)'
        },
        {
          name: 'confirmPassword',
          type: 'password',
          placeholder: 'Confirm Backup Password'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Export',
          handler: async (data: { password?: string; confirmPassword?: string }) => {
            if (!data.password || data.password.length < 8) {
              this.showToast('Backup password must be at least 8 characters.', 'danger');
              return false;
            }
            if (data.password !== data.confirmPassword) {
              this.showToast('Passwords do not match.', 'danger');
              return false;
            }
            await this.performExport(data.password);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async performExport(password: string): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Generating encrypted backup...' });
    await loading.present();

    try {
      const fileName = await this.backupService.exportBackup(password);
      await loading.dismiss();
      this.showToast(`Backup created: ${fileName}`, 'success');
    } catch (err: unknown) {
      await loading.dismiss();
      const msg = err instanceof Error ? err.message : String(err);
      this.showToast(`Export failed: ${msg}`, 'danger');
    }
  }

  public onImportBackup(): void {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  public async onFileSelected(event: any): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = '';

    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result as string;
      await this.promptForRestore(content);
    };
    reader.readAsText(file);
  }

  private async promptForRestore(fileContent: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Restore Encrypted Backup',
      subHeader: 'Warning: Full Vault Replacement',
      message: 'Restoring a backup will transactionally replace all current credentials with the records in the backup.\n\nEnter the backup password:',
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: 'Backup Password'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Decrypt & Restore',
          role: 'destructive',
          handler: async (data: { password?: string }) => {
            if (!data.password) {
              this.showToast('Backup password is required.', 'danger');
              return false;
            }
            await this.performRestore(fileContent, data.password);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async performRestore(content: string, pass: string): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Decrypting & restoring records...' });
    await loading.present();

    try {
      const count = await this.backupService.restoreBackup(content, pass);
      await loading.dismiss();
      this.showToast(`Vault successfully restored! (${count} credentials)`, 'success');
      await this.router.navigate(['/credentials']);
    } catch (err: unknown) {
      await loading.dismiss();
      const msg = err instanceof Error ? err.message : String(err);
      this.showToast(`Restore failed: ${msg}. Your existing vault was preserved.`, 'danger');
    }
  }

  public async onLockVaultNow(): Promise<void> {
    await this.sessionService.lock('User manual lock from Settings');
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
