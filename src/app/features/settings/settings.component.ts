import { Component, OnInit, signal } from '@angular/core';
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
  languageOutline,
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
import { BackupValidator } from '../../core/backup/backup-validator';
import { MAX_BACKUP_FILE_SIZE_BYTES } from '../../core/backup/backup-format';
import { LanguageService } from '../../core/i18n/language.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslatePipe,
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {

  public isBiometricAvailable = signal(false);
  public isBiometricEnrolled = signal(false);
  public autoLockTimeout = signal(300);
  public visibilityTimeout = signal(30);
  public clipboardTimeout = signal(30);

  private get translate(): LanguageService {
    return this.languageService;
  }

  constructor(
    private biometricService: BiometricService,
    private masterPasswordService: MasterPasswordService,
    private sessionService: VaultSessionService,
    private autoLockService: AutoLockService,
    private appPrivacyService: AppPrivacyService,
    private clipboardService: ClipboardService,
    private backupService: BackupService,
    private backupValidator: BackupValidator,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private router: Router,
    public languageService: LanguageService
  ) {
    addIcons({
      fingerPrint,
      timerOutline,
      keyOutline,
      cloudUploadOutline,
      cloudDownloadOutline,
      shieldCheckmarkOutline,
      lockClosed,
      informationCircleOutline,
      languageOutline
    });
  }

  public async ngOnInit(): Promise<void> {
    await this.loadSettings();
  }

  public async onLanguageChange(value: unknown): Promise<void> {
    if (!this.languageService.isAppLanguage(value)) {
      console.error('Unsupported language selected:', value);
      await this.showToast(this.languageService.instant('SETTINGS.LANGUAGE_INVALID'), 'danger');
      return;
    }

    try {
      await this.languageService.setLanguage(value);
    } catch (err: unknown) {
      console.error('Failed to save language preference:', err);
      await this.showToast(this.languageService.instant('SETTINGS.LANGUAGE_SAVE_FAILED'), 'danger');
    }
  }

  private async loadSettings(): Promise<void> {
    const bio = await this.biometricService.getStatus();
    this.isBiometricAvailable.set(bio.available);
    this.isBiometricEnrolled.set(bio.enrolled);

    this.autoLockTimeout.set(await this.autoLockService.getTimeout());
    this.visibilityTimeout.set(await this.appPrivacyService.getVisibilityTimeout());
    this.clipboardTimeout.set(await this.clipboardService.getTimeout());
  }

  public async onToggleBiometrics(event: any): Promise<void> {
    const enable = event.detail.checked;

    if (enable && !this.isBiometricEnrolled()) {
      const alert = await this.alertCtrl.create({
        header: this.translate.instant('SETTINGS.BIOMETRIC_ENABLE_TITLE'),
        message: this.translate.instant('SETTINGS.BIOMETRIC_ENABLE_MESSAGE'),
        inputs: [
          {
            name: 'password',
            type: 'password',
            placeholder: this.translate.instant('COMMON.MASTER_PASSWORD')
          }
        ],
        buttons: [
          {
            text: this.translate.instant('COMMON.CANCEL'),
            role: 'cancel',
            handler: () => {
              this.isBiometricEnrolled.set(false);
            }
          },
          {
            text: this.translate.instant('SETTINGS.VERIFY_ENROLL'),
            handler: async (data: { password?: string }) => {
              if (!data.password) {
                this.isBiometricEnrolled.set(false);
                return;
              }
              await this.performBiometricEnrollment(data.password);
            }
          }
        ]
      });
      await alert.present();

    } else if (!enable && this.isBiometricEnrolled()) {
      await this.biometricService.disable();
      this.isBiometricEnrolled.set(false);
      const toast = await this.toastCtrl.create({
        message: this.translate.instant('SETTINGS.BIOMETRIC_DISABLED'),
        duration: 2000,
        position: 'bottom'
      });
      await toast.present();
    }
  }

  private async performBiometricEnrollment(password: string): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: this.translate.instant('SETTINGS.VERIFYING_MASTER_KEY') });
    await loading.present();

    try {
      const dek = await this.masterPasswordService.verifyAndUnlock(password);
      await loading.dismiss();

      const result = await this.biometricService.enroll(dek);
      if (result.success) {
        this.isBiometricEnrolled.set(true);
        const toast = await this.toastCtrl.create({
          message: this.translate.instant('SETTINGS.BIOMETRIC_ENABLED'),
          duration: 2500,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
      } else {
        this.isBiometricEnrolled.set(false);
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
      this.isBiometricEnrolled.set(false);
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
    await this.autoLockService.setTimeout(this.autoLockTimeout());
  }

  public async onVisibilityTimeoutChange(): Promise<void> {
    await this.appPrivacyService.setVisibilityTimeout(this.visibilityTimeout());
  }

  public async onClipboardTimeoutChange(): Promise<void> {
    await this.clipboardService.setTimeout(this.clipboardTimeout());
  }

  public async onChangeMasterPassword(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('SETTINGS.CHANGE_MASTER_PASSWORD'),
      subHeader: this.translate.instant('SETTINGS.REENCRYPT_MASTER_KEY'),
      inputs: [
        {
          name: 'currentPassword',
          type: 'password',
          placeholder: this.translate.instant('SETTINGS.CURRENT_MASTER_PASSWORD')
        },
        {
          name: 'newPassword',
          type: 'password',
          placeholder: this.translate.instant('SETTINGS.NEW_MASTER_PASSWORD')
        },
        {
          name: 'confirmNewPassword',
          type: 'password',
          placeholder: this.translate.instant('SETTINGS.CONFIRM_NEW_MASTER_PASSWORD')
        }
      ],
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('SETTINGS.CHANGE_PASSWORD'),
          handler: async (data: { currentPassword?: string; newPassword?: string; confirmNewPassword?: string }) => {
            if (!data.currentPassword || !data.newPassword || !data.confirmNewPassword) {
              this.showToast(this.translate.instant('SETTINGS.PASSWORD_FIELDS_REQUIRED'), 'danger');
              return false;
            }
            if (data.newPassword.length < 8) {
              this.showToast(this.translate.instant('SETTINGS.NEW_PASSWORD_TOO_SHORT'), 'danger');
              return false;
            }
            if (data.newPassword !== data.confirmNewPassword) {
              this.showToast(this.translate.instant('SETTINGS.PASSWORDS_DO_NOT_MATCH'), 'danger');
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
    const loading = await this.loadingCtrl.create({ message: this.translate.instant('SETTINGS.DERIVING_NEW_KEY') });
    await loading.present();

    try {
      const activeDek = this.sessionService.getActiveDek();
      await this.masterPasswordService.changeMasterPassword(curr, next, activeDek);
      await loading.dismiss();

      this.showToast(this.translate.instant('SETTINGS.PASSWORD_CHANGED'), 'success');
    } catch (err: unknown) {
      await loading.dismiss();
      const msg = err instanceof Error ? err.message : String(err);
      this.showToast(msg, 'danger');
    }
  }

  public async onExportBackup(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('SETTINGS.EXPORT_BACKUP'),
      subHeader: this.translate.instant('SETTINGS.CREATE_BACKUP_FILE'),
      message: this.translate.instant('SETTINGS.EXPORT_BACKUP_MESSAGE'),
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: this.translate.instant('SETTINGS.BACKUP_PASSWORD')
        },
        {
          name: 'confirmPassword',
          type: 'password',
          placeholder: this.translate.instant('SETTINGS.CONFIRM_BACKUP_PASSWORD')
        }
      ],
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('COMMON.EXPORT'),
          handler: async (data: { password?: string; confirmPassword?: string }) => {
            if (!data.password || data.password.length < 8) {
              this.showToast(this.translate.instant('SETTINGS.BACKUP_PASSWORD_TOO_SHORT'), 'danger');
              return false;
            }
            if (data.password !== data.confirmPassword) {
              this.showToast(this.translate.instant('SETTINGS.PASSWORDS_DO_NOT_MATCH'), 'danger');
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
    const loading = await this.loadingCtrl.create({ message: this.translate.instant('SETTINGS.GENERATING_BACKUP') });
    await loading.present();

    try {
      const fileName = await this.backupService.exportBackup(password);
      await loading.dismiss();
      this.showToast(this.translate.instant('SETTINGS.BACKUP_CREATED', { fileName }), 'success');
    } catch (err: unknown) {
      await loading.dismiss();
      const msg = err instanceof Error ? err.message : String(err);
      this.showToast(this.translate.instant('SETTINGS.EXPORT_FAILED', { message: msg }), 'danger');
    }
  }

  public onImportBackup(): void {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  public async onFileSelected(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const file = input.files?.[0];
    if (!file) {
      return;
    }

    input.value = '';

    if (file.size > MAX_BACKUP_FILE_SIZE_BYTES) {
      await this.showRestoreFailure(
        new Error('Backup file exceeds maximum permitted size of 10 MB.')
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result;
      if (typeof content !== 'string') {
        await this.showRestoreFailure(new Error('Backup file could not be read as text.'));
        return;
      }

      try {
        this.backupValidator.validateFileStructure(content);
      } catch (err: unknown) {
        await this.showRestoreFailure(err);
        return;
      }

      await this.promptForRestore(content);
    };
    reader.onerror = async () => {
      await this.showRestoreFailure(new Error('Selected backup file could not be read.'));
    };
    reader.readAsText(file);
  }

  private async promptForRestore(fileContent: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('SETTINGS.RESTORE_BACKUP'),
      subHeader: this.translate.instant('SETTINGS.FULL_VAULT_REPLACEMENT'),
      message: this.translate.instant('SETTINGS.RESTORE_BACKUP_MESSAGE'),
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: this.translate.instant('SETTINGS.BACKUP_PASSWORD_SHORT')
        }
      ],
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('SETTINGS.DECRYPT_RESTORE'),
          role: 'destructive',
          handler: async (data: { password?: string }) => {
            if (!data.password) {
              this.showToast(this.translate.instant('SETTINGS.BACKUP_PASSWORD_REQUIRED'), 'danger');
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
    const loading = await this.loadingCtrl.create({ message: this.translate.instant('SETTINGS.RESTORING_RECORDS') });
    await loading.present();

    try {
      const count = await this.backupService.restoreBackup(content, pass);
      await loading.dismiss();
      this.showToast(this.translate.instant('SETTINGS.VAULT_RESTORED', { count }), 'success');
      await this.router.navigate(['/credentials']);
    } catch (err: unknown) {
      await loading.dismiss();
      await this.showRestoreFailure(err);
    }
  }

  private async showRestoreFailure(err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    await this.showToast(
      this.translate.instant('SETTINGS.RESTORE_FAILED', { message }),
      'danger'
    );
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
