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
  templateUrl: './credential-editor.component.html',
  styleUrls: ['./credential-editor.component.css']
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
