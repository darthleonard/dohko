import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertController,
  IonicModule,
  ModalController,
  ToastController
} from '@ionic/angular/lazy';
import { addIcons } from 'ionicons';
import {
  close,
  copyOutline,
  createOutline,
  eye,
  eyeOff,
  globeOutline,
  keyOutline,
  openOutline,
  personOutline,
  trashOutline
} from 'ionicons/icons';
import { Credential, CredentialRepository } from '../../core/database/credential.repository';
import { AppPrivacyService } from '../../core/security/app-privacy.service';
import { ClipboardService } from '../../core/security/clipboard.service';
import { CredentialEditorComponent } from './credential-editor.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-credential-detail',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    TranslatePipe
  ],
  templateUrl: './credential-detail.component.html',
  styleUrls: ['./credential-detail.component.css']
})
export class CredentialDetailComponent implements OnInit {

  private credentialState = signal<Credential | null>(null);

  @Input()
  public set credential(value: Credential) {
    this.credentialState.set(value);
  }

  public get credential(): Credential {
    const credential = this.credentialState();
    if (!credential) {
      throw new Error('Credential detail requires a credential input.');
    }
    return credential;
  }

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private credentialRepo: CredentialRepository,
    private appPrivacy: AppPrivacyService,
    private clipboardService: ClipboardService,
    private translate: LanguageService
  ) {
    addIcons({
      close,
      createOutline,
      trashOutline,
      personOutline,
      copyOutline,
      keyOutline,
      eye,
      eyeOff,
      globeOutline,
      openOutline
    });
  }

  public ngOnInit(): void {
    this.appPrivacy.hideAllPasswords();
  }

  public get isPasswordRevealed(): boolean {
    return this.appPrivacy.isPasswordRevealed(this.credential.id);
  }

  public async onTogglePasswordView(): Promise<void> {
    if (this.isPasswordRevealed) {
      this.appPrivacy.hideAllPasswords();
    } else {
      await this.appPrivacy.revealPassword(this.credential.id);
    }
  }

  public async onCopyUsername(): Promise<void> {
    await this.clipboardService.copySensitive(this.credential.username, false);
    const toast = await this.toastCtrl.create({
      message: this.translate.instant('DETAIL.USERNAME_COPIED'),
      duration: 2000,
      position: 'bottom',
      color: 'dark'
    });
    await toast.present();
  }

  public async onCopyPassword(): Promise<void> {
    await this.clipboardService.copySensitive(this.credential.password);
    const timeout = await this.clipboardService.getTimeout();
    const message = timeout > 0
      ? this.translate.instant('VAULT.PASSWORD_COPIED_TIMEOUT', { seconds: timeout })
      : this.translate.instant('VAULT.PASSWORD_COPIED');

    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
  }

  public onOpenUrl(): void {
    if (this.credential.websiteUrl) {
      window.open(this.credential.websiteUrl, '_blank');
    }
  }

  public async onEdit(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: CredentialEditorComponent,
      componentProps: { credential: this.credential }
    });
    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.saved && data.credential) {
      this.credential = data.credential;
      this.appPrivacy.hideAllPasswords();
    }
  }

  public async onDelete(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('VAULT.DELETE_CREDENTIAL'),
      message: this.translate.instant('DETAIL.CONFIRM_DELETE', {
        name: this.credential.name,
      }),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('COMMON.DELETE'),
          role: 'destructive',
          handler: async () => {
            await this.credentialRepo.delete(this.credential.id);
            this.appPrivacy.hideAllPasswords();
            await this.modalCtrl.dismiss({ deleted: true, id: this.credential.id });
          }
        }
      ]
    });
    await alert.present();
  }

  public async onClose(): Promise<void> {
    this.appPrivacy.hideAllPasswords();
    await this.modalCtrl.dismiss({ credential: this.credential });
  }

  public formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(this.translate.currentLang);
    } catch {
      return iso;
    }
  }
}
