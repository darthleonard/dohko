import { ModalController } from '@ionic/angular/lazy';
import { Credential, CredentialRepository } from '../../core/database/credential.repository';
import { CredentialEditorComponent } from './credential-editor.component';

describe('CredentialEditorComponent', () => {
  let modalCtrl: { dismiss: ReturnType<typeof vi.fn> };
  let credentialRepo: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    modalCtrl = { dismiss: vi.fn().mockResolvedValue(undefined) };
    credentialRepo = {
      create: vi.fn(),
      update: vi.fn()
    };
  });

  it('creates a credential with trimmed optional fields and dismisses with the saved credential', async () => {
    const saved: Credential = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Example',
      username: 'user@example.com',
      password: 'secret',
      websiteUrl: 'https://example.com',
      notes: 'Personal account',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };
    credentialRepo.create.mockResolvedValue(saved);
    const component = new CredentialEditorComponent(
      modalCtrl as unknown as ModalController,
      credentialRepo as unknown as CredentialRepository
    );
    component.name = '  Example  ';
    component.username = ' user@example.com ';
    component.password = 'secret';
    component.websiteUrl = ' https://example.com ';
    component.notes = ' Personal account ';

    await component.onSave();

    expect(credentialRepo.create).toHaveBeenCalledWith({
      name: 'Example',
      username: 'user@example.com',
      password: 'secret',
      websiteUrl: 'https://example.com',
      notes: 'Personal account'
    });
    expect(credentialRepo.update).not.toHaveBeenCalled();
    expect(modalCtrl.dismiss).toHaveBeenCalledWith({ saved: true, credential: saved });
    expect(component.isSaving()).toBe(false);
  });

  it('updates the selected credential and preserves its original creation time', async () => {
    const original: Credential = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Old name',
      username: 'old@example.com',
      password: 'old secret',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z'
    };
    const updated: Credential = {
      ...original,
      name: 'New name',
      username: 'new@example.com',
      password: 'new secret'
    };
    credentialRepo.update.mockResolvedValue(updated);
    const component = new CredentialEditorComponent(
      modalCtrl as unknown as ModalController,
      credentialRepo as unknown as CredentialRepository
    );
    component.credential = original;
    component.ngOnInit();

    expect(component.isEditing).toBe(true);
    expect(component.name).toBe('Old name');
    component.name = ' New name ';
    component.username = ' new@example.com ';
    component.password = 'new secret';

    await component.onSave();

    expect(credentialRepo.update).toHaveBeenCalledWith({
      id: original.id,
      name: 'New name',
      username: 'new@example.com',
      password: 'new secret',
      websiteUrl: undefined,
      notes: undefined,
      createdAt: original.createdAt
    });
    expect(credentialRepo.create).not.toHaveBeenCalled();
    expect(modalCtrl.dismiss).toHaveBeenCalledWith({ saved: true, credential: updated });
    expect(component.isSaving()).toBe(false);
  });
});
