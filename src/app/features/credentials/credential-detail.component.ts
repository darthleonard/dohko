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
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ credential.name }}</ion-title>
        <ion-buttons slot="start">
          <ion-button (click)="onClose()">
            <ion-icon name="close" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button (click)="onEdit()">
            <ion-icon name="create-outline" slot="icon-only"></ion-icon>
          </ion-button>
          <ion-button color="danger" (click)="onDelete()">
            <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ credential.name }}</ion-card-title>
          <ion-card-subtitle *ngIf="credential.websiteUrl">{{ credential.websiteUrl }}</ion-card-subtitle>
        </ion-card-header>

        <ion-card-content>
          <ion-list lines="inset">
            <!-- Username -->
            <ion-item>
              <ion-icon name="person-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h3>Username / Email</h3>
                <p class="selectable">{{ credential.username }}</p>
              </ion-label>
              <ion-button fill="clear" slot="end" (click)="onCopyUsername()" aria-label="Copy username">
                <ion-icon name="copy-outline" slot="icon-only"></ion-icon>
              </ion-button>
            </ion-item>

            <!-- Password -->
            <ion-item>
              <ion-icon name="key-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h3>Password</h3>
                <p class="secret-text" [class.revealed]="isPasswordRevealed">
                  {{ isPasswordRevealed ? credential.password : '••••••••••••' }}
                </p>
                <ion-note *ngIf="isPasswordRevealed" color="warning" class="timeout-note">
                  Auto-hiding active
                </ion-note>
              </ion-label>
              <ion-button
                fill="clear"
                slot="end"
                (click)="onTogglePasswordView()"
                [color]="isPasswordRevealed ? 'warning' : 'medium'"
                aria-label="Toggle password visibility"
              >
                <ion-icon [name]="isPasswordRevealed ? 'eye-off' : 'eye'" slot="icon-only"></ion-icon>
              </ion-button>
              <ion-button fill="clear" slot="end" (click)="onCopyPassword()" aria-label="Copy password">
                <ion-icon name="copy-outline" slot="icon-only"></ion-icon>
              </ion-button>
            </ion-item>

            <!-- Website -->
            <ion-item *ngIf="credential.websiteUrl">
              <ion-icon name="globe-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h3>Website URL</h3>
                <p class="selectable">{{ credential.websiteUrl }}</p>
              </ion-label>
              <ion-button fill="clear" slot="end" (click)="onOpenUrl()" aria-label="Open website">
                <ion-icon name="open-outline" slot="icon-only"></ion-icon>
              </ion-button>
            </ion-item>

            <!-- Notes -->
            <ion-item *ngIf="credential.notes">
              <ion-label class="ion-text-wrap">
                <h3>Notes</h3>
                <p class="notes-text">{{ credential.notes }}</p>
              </ion-label>
            </ion-item>
          </ion-list>

          <div class="timestamps ion-margin-top ion-padding-start">
            <ion-note color="medium">
              Created: {{ formatDate(credential.createdAt) }}<br />
              Updated: {{ formatDate(credential.updatedAt) }}
            </ion-note>
          </div>
        </ion-card-content>
      </ion-card>
    </ion-content>
  `,
  styles: [`
    .selectable {
      user-select: text;
      font-size: 1.05rem;
      margin-top: 4px;
    }
    .secret-text {
      font-family: monospace;
      font-size: 1.1rem;
      letter-spacing: 2px;
      margin-top: 4px;
    }
    .secret-text.revealed {
      letter-spacing: 0.5px;
      color: var(--ion-color-dark);
    }
    .timeout-note {
      font-size: 0.75rem;
      display: block;
      margin-top: 2px;
    }
    .notes-text {
      white-space: pre-wrap;
      font-size: 0.95rem;
      line-height: 1.4;
      margin-top: 4px;
    }
    .timestamps {
      font-size: 0.78rem;
    }
  `]
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
