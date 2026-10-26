import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ActionSheetController,
  AlertController,
  IonicModule,
  ModalController,
  ToastController
} from '@ionic/angular/lazy';
import { addIcons } from 'ionicons';
import {
  add,
  copyOutline,
  createOutline,
  ellipsisVertical,
  eye,
  eyeOff,
  globeOutline,
  keyOutline,
  lockClosed,
  searchOutline,
  settingsOutline,
  trashOutline
} from 'ionicons/icons';
import { Credential, CredentialRepository } from '../../core/database/credential.repository';
import { VaultSessionService } from '../../core/auth/vault-session.service';
import { AppPrivacyService } from '../../core/security/app-privacy.service';
import { ClipboardService } from '../../core/security/clipboard.service';
import { CredentialEditorComponent } from './credential-editor.component';
import { CredentialDetailComponent } from './credential-detail.component';

@Component({
  selector: 'app-credential-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ],
  templateUrl: './credential-list.component.html',
  styleUrls: ['./credential-list.component.css']
})
export class CredentialListComponent implements OnInit, OnDestroy {

  public credentials: Credential[] = [];
  public searchQuery = '';
  private currentRevealedId: string | null = null;
  private sub = new Subscription();

  constructor(
    private credentialRepo: CredentialRepository,
    private sessionService: VaultSessionService,
    private appPrivacy: AppPrivacyService,
    private clipboardService: ClipboardService,
    private modalCtrl: ModalController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private router: Router
  ) {
    addIcons({
      lockClosed,
      settingsOutline,
      keyOutline,
      add,
      searchOutline,
      eye,
      eyeOff,
      copyOutline,
      ellipsisVertical,
      createOutline,
      trashOutline,
      globeOutline
    });
  }

  public ngOnInit(): void {
    this.sub.add(
      this.appPrivacy.revealedCredentialId$.subscribe(id => {
        this.currentRevealedId = id;
      })
    );
    this.loadCredentials();
  }

  public ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.appPrivacy.hideAllPasswords();
  }

  public async loadCredentials(): Promise<void> {
    const generation = this.sessionService.getSessionGeneration();
    const list = this.searchQuery.trim()
      ? await this.credentialRepo.search(this.searchQuery)
      : await this.credentialRepo.getAll();

    if (this.sessionService.isSessionValid(generation)) {
      this.credentials = list;
    }
  }

  public onSearch(): void {
    this.loadCredentials();
  }

  public isRevealed(id: string): boolean {
    return this.currentRevealedId === id;
  }

  public async onToggleView(cred: Credential): Promise<void> {
    if (this.isRevealed(cred.id)) {
      this.appPrivacy.hideAllPasswords();
    } else {
      await this.appPrivacy.revealPassword(cred.id);
    }
  }

  public async onCopyPassword(cred: Credential): Promise<void> {
    await this.clipboardService.copySensitive(cred.password);
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

  public async onAddCredential(): Promise<void> {
    this.appPrivacy.hideAllPasswords();
    const modal = await this.modalCtrl.create({
      component: CredentialEditorComponent
    });
    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.saved) {
      await this.loadCredentials();
    }
  }

  public async onViewDetail(cred: Credential): Promise<void> {
    this.appPrivacy.hideAllPasswords();
    const modal = await this.modalCtrl.create({
      component: CredentialDetailComponent,
      componentProps: { credential: cred }
    });
    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.deleted || data?.credential) {
      await this.loadCredentials();
    }
  }

  public async onEditCredential(cred: Credential): Promise<void> {
    this.appPrivacy.hideAllPasswords();
    const modal = await this.modalCtrl.create({
      component: CredentialEditorComponent,
      componentProps: { credential: cred }
    });
    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.saved) {
      await this.loadCredentials();
    }
  }

  public async onDeleteCredential(cred: Credential): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Credential',
      message: `Are you sure you want to delete "${cred.name}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            await this.credentialRepo.delete(cred.id);
            this.appPrivacy.hideAllPasswords();
            await this.loadCredentials();
          }
        }
      ]
    });
    await alert.present();
  }

  public async onShowOptions(cred: Credential): Promise<void> {
    const actionSheet = await this.actionSheetCtrl.create({
      header: cred.name,
      buttons: [
        {
          text: 'Copy Username',
          icon: 'copy-outline',
          handler: async () => {
            await this.clipboardService.copySensitive(cred.username);
            const toast = await this.toastCtrl.create({
              message: 'Username copied',
              duration: 2000,
              position: 'bottom',
              color: 'dark'
            });
            await toast.present();
          }
        },
        {
          text: 'Copy Password',
          icon: 'key-outline',
          handler: () => {
            this.onCopyPassword(cred);
          }
        },
        {
          text: 'View Details',
          icon: 'eye',
          handler: () => {
            this.onViewDetail(cred);
          }
        },
        {
          text: 'Edit',
          icon: 'create-outline',
          handler: () => {
            this.onEditCredential(cred);
          }
        },
        {
          text: 'Delete',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => {
            this.onDeleteCredential(cred);
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  public async onOpenSettings(): Promise<void> {
    this.appPrivacy.hideAllPasswords();
    await this.router.navigate(['/settings']);
  }

  public async onLock(): Promise<void> {
    await this.sessionService.lock('User manual lock');
  }

  public trackById(_index: number, item: Credential): string {
    return item.id;
  }
}
