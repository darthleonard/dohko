import { TestBed } from '@angular/core/testing';
import { CredentialRepository } from './credential.repository';
import { DatabaseService } from './database.service';

describe('CredentialRepository', () => {
  let repository: CredentialRepository;
  let dbService: {
    beginTransaction: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
    commitTransaction: ReturnType<typeof vi.fn>;
    rollbackTransaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    dbService = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue({ changes: 1 }),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined)
    };

    TestBed.configureTestingModule({
      providers: [
        CredentialRepository,
        { provide: DatabaseService, useValue: dbService }
      ]
    });
    repository = TestBed.inject(CredentialRepository);
  });

  it('runs restore statements inside one explicit transaction', async () => {
    await repository.restoreAll([]);

    expect(dbService.beginTransaction).toHaveBeenCalledOnce();
    expect(dbService.run).toHaveBeenCalledWith('DELETE FROM credentials;', [], false);
    expect(dbService.commitTransaction).toHaveBeenCalledOnce();
    expect(dbService.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('rolls back the restore transaction when a statement fails', async () => {
    const error = new Error('Database write failed');
    dbService.run.mockRejectedValueOnce(error);

    await expect(repository.restoreAll([])).rejects.toBe(error);

    expect(dbService.rollbackTransaction).toHaveBeenCalledOnce();
    expect(dbService.commitTransaction).not.toHaveBeenCalled();
  });
});
