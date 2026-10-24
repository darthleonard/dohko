import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular/lazy';
import { addIcons } from 'ionicons';
import { close, eye, eyeOff, save } from 'ionicons/icons';
import { Credential, CredentialRepository } from '../../core/database/credential.repository';

@Component({
  selector: 'app-credential-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ isEditing ? 'Edit Credential' : 'New Credential' }}</ion-title>
        <ion-buttons slot="start">
          <ion-button (click)="onCancel()">
            <ion-icon name="close" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button (click)="onSave()" [disabled]="!isFormValid() || isSaving">
            <ion-icon name="save" slot="start"></ion-icon>
            Save
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form (ngSubmit)="onSave()">
        <!-- Label / Name -->
        <ion-item class="ion-margin-bottom">
          <ion-input
            label="Service / Label *"
            labelPlacement="floating"
            [(ngModel)]="name"
            name="name"
            required
            placeholder="e.g. GitHub, Google, Work Email"
            maxlength="200"
          ></ion-input>
        </ion-item>

        <!-- Username / Email -->
        <ion-item class="ion-margin-bottom">
          <ion-input
            label="Username / Email *"
            labelPlacement="floating"
            [(ngModel)]="username"
            name="username"
            required
            placeholder="e.g. user@example.com"
            maxlength="200"
          ></ion-input>
        </ion-item>

        <!-- Password -->
        <ion-item class="ion-margin-bottom">
          <ion-input
            [type]="showPassword ? 'text' : 'password'"
            label="Password *"
            labelPlacement="floating"
            [(ngModel)]="password"
            name="password"
            required
            placeholder="Enter credential password"
            maxlength="5000"
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

        <!-- Website URL -->
        <ion-item class="ion-margin-bottom">
          <ion-input
            type="url"
            label="Website URL (optional)"
            labelPlacement="floating"
            [(ngModel)]="websiteUrl"
            name="websiteUrl"
            placeholder="https://example.com"
            maxlength="2048"
          ></ion-input>
        </ion-item>
        <ion-note *ngIf="websiteUrl && !isValidUrl(websiteUrl)" color="danger" class="url-error ion-padding-start">
          Please enter a valid URL (starting with http:// or https://)
        </ion-note>

        <!-- Notes -->
        <ion-item class="ion-margin-bottom">
          <ion-textarea
            label="Notes (optional)"
            labelPlacement="floating"
            [(ngModel)]="notes"
            name="notes"
            rows="4"
            placeholder="Additional notes, recovery codes, or security info"
            maxlength="10000"
          ></ion-textarea>
        </ion-item>

        <div *ngIf="errorMessage" class="error-box ion-margin-top">
          <ion-text color="danger">{{ errorMessage }}</ion-text>
        </div>
      </form>
    </ion-content>
  `,
  styles: [`
    .url-error {
      font-size: 0.8rem;
      margin-top: -8px;
      margin-bottom: 8px;
      display: block;
    }
    .error-box {
      padding: 10px;
      background: var(--ion-color-danger-tint, #ffebee);
      border-radius: 6px;
    }
  `]
})
export class CredentialEditorComponent implements OnInit {

  @Input() public credential?: Credential;

  public name = '';
  public username = '';
  public password = '';
  public websiteUrl = '';
  public notes = '';
  public showPassword = false;
  public isEditing = false;
  public isSaving = false;
  public errorMessage = '';

  constructor(
    private modalCtrl: ModalController,
    private credentialRepo: CredentialRepository
  ) {
    addIcons({ close, save, eye, eyeOff });
  }

  public ngOnInit(): void {
    if (this.credential) {
      this.isEditing = true;
      this.name = this.credential.name;
      this.username = this.credential.username;
      this.password = this.credential.password;
      this.websiteUrl = this.credential.websiteUrl || '';
      this.notes = this.credential.notes || '';
    }
  }

  public isFormValid(): boolean {
    if (!this.name.trim() || !this.username.trim() || !this.password) {
      return false;
    }
    if (this.websiteUrl.trim() && !this.isValidUrl(this.websiteUrl.trim())) {
      return false;
    }
    return true;
  }

  public isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  public async onSave(): Promise<void> {
    if (!this.isFormValid() || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    try {
      let saved: Credential;

      if (this.isEditing && this.credential) {
        saved = await this.credentialRepo.update({
          id: this.credential.id,
          name: this.name.trim(),
          username: this.username.trim(),
          password: this.password,
          websiteUrl: this.websiteUrl.trim() || undefined,
          notes: this.notes.trim() || undefined,
          createdAt: this.credential.createdAt
        });
      } else {
        saved = await this.credentialRepo.create({
          name: this.name.trim(),
          username: this.username.trim(),
          password: this.password,
          websiteUrl: this.websiteUrl.trim() || undefined,
          notes: this.notes.trim() || undefined
        });
      }

      await this.modalCtrl.dismiss({ saved: true, credential: saved });
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      this.isSaving = false;
    }
  }

  public async onCancel(): Promise<void> {
    await this.modalCtrl.dismiss({ saved: false });
  }
}
