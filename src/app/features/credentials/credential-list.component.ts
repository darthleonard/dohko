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
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-title>Vault</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="onOpenSettings()" aria-label="Settings">
            <ion-icon name="settings-outline" slot="icon-only"></ion-icon>
          </ion-button>
          <ion-button (click)="onLock()" aria-label="Lock Vault">
            <ion-icon name="lock-closed" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <ion-toolbar color="primary">
        <ion-searchbar
          [(ngModel)]="searchQuery"
          (ionInput)="onSearch()"
          placeholder="Search by label, username, or website"
          debounce="200"
          showClearButton="focus"
        ></ion-searchbar>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Empty State -->
      <div *ngIf="credentials.length === 0 && !searchQuery" class="empty-state ion-text-center ion-padding">
        <div class="empty-icon-wrapper">
          <ion-icon name="key-outline" class="empty-icon"></ion-icon>
        </div>
        <h3>No Credentials Yet</h3>
        <p>Your vault is currently empty. Tap the "+" button below to add your first secure credential.</p>
        <ion-button (click)="onAddCredential()" class="ion-margin-top">
          <ion-icon name="add" slot="start"></ion-icon>
          Add Credential
        </ion-button>
      </div>

      <!-- No Search Results -->
      <div *ngIf="credentials.length === 0 && searchQuery" class="empty-state ion-text-center ion-padding">
        <ion-icon name="search-outline" class="empty-icon" color="medium"></ion-icon>
        <h3>No Matches Found</h3>
        <p>No credentials match "{{ searchQuery }}"</p>
      </div>

      <!-- Credentials List -->
      <ion-list *ngIf="credentials.length > 0" lines="full">
        <ion-item-sliding *ngFor="let cred of credentials; trackBy: trackById">
          <ion-item button (click)="onViewDetail(cred)">
            <ion-icon name="key-outline" slot="start" color="primary"></ion-icon>
            <ion-label>
              <h2>{{ cred.name }}</h2>
              <p class="username-sub">{{ cred.username }}</p>
              <p class="secret-masked">
                <span *ngIf="!isRevealed(cred.id)">••••••••</span>
                <span *ngIf="isRevealed(cred.id)" class="revealed-text">{{ cred.password }}</span>
              </p>
            </ion-label>

            <!-- Quick View Toggle -->
            <ion-button
              fill="clear"
              slot="end"
              (click)="$event.stopPropagation(); onToggleView(cred)"
              [color]="isRevealed(cred.id) ? 'warning' : 'medium'"
              aria-label="Toggle password view"
            >
              <ion-icon [name]="isRevealed(cred.id) ? 'eye-off' : 'eye'" slot="icon-only"></ion-icon>
            </ion-button>

            <!-- Quick Copy Password -->
            <ion-button
              fill="clear"
              slot="end"
              (click)="$event.stopPropagation(); onCopyPassword(cred)"
              aria-label="Copy password"
            >
              <ion-icon name="copy-outline" slot="icon-only"></ion-icon>
            </ion-button>

            <!-- More Options -->
            <ion-button
              fill="clear"
              slot="end"
              (click)="$event.stopPropagation(); onShowOptions(cred)"
              aria-label="More options"
            >
              <ion-icon name="ellipsis-vertical" slot="icon-only"></ion-icon>
            </ion-button>
          </ion-item>

          <ion-item-options side="end">
            <ion-item-option color="primary" (click)="onEditCredential(cred)">
              <ion-icon name="create-outline" slot="icon-only"></ion-icon>
            </ion-item-option>
            <ion-item-option color="danger" (click)="onDeleteCredential(cred)">
              <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <!-- FAB to Add -->
      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="onAddCredential()" aria-label="Add credential">
          <ion-icon name="add"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .empty-state {
      max-width: 400px;
      margin: 80px auto 0;
      color: var(--ion-color-medium);
    }
    .empty-icon-wrapper {
      width: 90px;
      height: 90px;
      margin: 0 auto 16px;
      border-radius: 50%;
      background: var(--ion-color-primary-tint, #e3f2fd);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .empty-icon {
      font-size: 48px;
      color: var(--ion-color-primary);
    }
    .username-sub {
      color: var(--ion-color-step-600, #666);
      font-size: 0.9rem;
    }
    .secret-masked {
      font-family: monospace;
      font-size: 0.95rem;
      letter-spacing: 2px;
      margin-top: 2px;
      color: var(--ion-color-medium);
    }
    .revealed-text {
      letter-spacing: normal;
      color: var(--ion-color-dark);
      font-weight: 500;
    }
  `]
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
