import { Component, Input, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-credential-detail',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule
  ],
  templateUrl: './credential-detail.component.html',
  styleUrls: ['./credential-detail.component.css']
})
export class CredentialDetailComponent implements OnInit {

  @Input() public credential!: Credential;

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private credentialRepo: CredentialRepository,
    private appPrivacy: AppPrivacyService,
    private clipboardService: ClipboardService
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
    await this.clipboardService.copySensitive(this.credential.username);
    const toast = await this.toastCtrl.create({
      message: 'Username copied to clipboard',
      duration: 2000,
      position: 'bottom',
      color: 'dark'
    });
    await toast.present();
  }

  public async onCopyPassword(): Promise<void> {
    await this.clipboardService.copySensitive(this.credential.password);
    const timeout = await this.clipboardService.getTimeout();
    const timeoutMsg = timeout > 0 ? ` (clears in ${timeout}s)` : '';

    const toast = await this.toastCtrl.create({
      message: `Password copied to clipboard${timeoutMsg}`,
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
      header: 'Delete Credential',
      message: `Are you sure you want to delete "${this.credential.name}"? This action cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
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
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }
}
