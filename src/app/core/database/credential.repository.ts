import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';

export interface Credential {
  id: string; // UUID string
  name: string; // website, app, or service label
  username: string; // username or email address
  password: string; // password
  websiteUrl?: string; // optional website URL
  notes?: string; // optional notes
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

export type CreateCredentialInput = Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCredentialInput = Omit<Credential, 'createdAt' | 'updatedAt'> & Partial<Pick<Credential, 'createdAt'>>;

interface CredentialRow {
  id: string;
  name: string;
  username: string;
  password: string;
  website_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * CredentialRepository
 *
 * Provides CRUD operations and transactional restore for credentials stored
 * in the encrypted SQLCipher database.
 */
@Injectable({
  providedIn: 'root'
})
export class CredentialRepository {

  constructor(private dbService: DatabaseService) {}

  /**
   * Retrieves all credentials ordered alphabetically by name.
   */
  public async getAll(): Promise<Credential[]> {
    const sql = `
      SELECT id, name, username, password, website_url, notes, created_at, updated_at
      FROM credentials
      ORDER BY name COLLATE NOCASE ASC;
    `;
    const rows = await this.dbService.query<CredentialRow>(sql);
    return rows.map(r => this.mapRowToCredential(r));
  }

  /**
   * Retrieves a single credential by ID.
   */
  public async getById(id: string): Promise<Credential | null> {
    const sql = `
      SELECT id, name, username, password, website_url, notes, created_at, updated_at
      FROM credentials
      WHERE id = ?;
    `;
    const rows = await this.dbService.query<CredentialRow>(sql, [id]);
    if (rows.length === 0) {
      return null;
    }
    return this.mapRowToCredential(rows[0]);
  }

  /**
   * Searches credentials matching name, username, or websiteUrl.
   */
  public async search(term: string): Promise<Credential[]> {
    const trimmed = term.trim();
    if (!trimmed) {
      return this.getAll();
    }
    const pattern = `%${trimmed}%`;
    const sql = `
      SELECT id, name, username, password, website_url, notes, created_at, updated_at
      FROM credentials
      WHERE name LIKE ? OR username LIKE ? OR website_url LIKE ?
      ORDER BY name COLLATE NOCASE ASC;
    `;
    const rows = await this.dbService.query<CredentialRow>(sql, [pattern, pattern, pattern]);
    return rows.map(r => this.mapRowToCredential(r));
  }

  /**
   * Creates and stores a new credential.
   */
  public async create(input: CreateCredentialInput): Promise<Credential> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const cred: Credential = {
      id,
      name: input.name.trim(),
      username: input.username.trim(),
      password: input.password,
      websiteUrl: input.websiteUrl?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now
    };

    const sql = `
      INSERT INTO credentials (id, name, username, password, website_url, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await this.dbService.run(sql, [
      cred.id,
      cred.name,
      cred.username,
      cred.password,
      cred.websiteUrl || null,
      cred.notes || null,
      cred.createdAt,
      cred.updatedAt
    ]);

    return cred;
  }

  /**
   * Updates an existing credential, preserving its original createdAt timestamp.
   */
  public async update(input: UpdateCredentialInput): Promise<Credential> {
    const existing = await this.getById(input.id);
    if (!existing) {
      throw new Error(`Credential with ID ${input.id} not found`);
    }

    const now = new Date().toISOString();
    const updated: Credential = {
      id: input.id,
      name: input.name.trim(),
      username: input.username.trim(),
      password: input.password,
      websiteUrl: input.websiteUrl?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: input.createdAt || existing.createdAt, // Preserve original createdAt
      updatedAt: now // Always update modification time
    };

    const sql = `
      UPDATE credentials
      SET name = ?, username = ?, password = ?, website_url = ?, notes = ?, updated_at = ?
      WHERE id = ?;
    `;

    await this.dbService.run(sql, [
      updated.name,
      updated.username,
      updated.password,
      updated.websiteUrl || null,
      updated.notes || null,
      updated.updatedAt,
      updated.id
    ]);

    return updated;
  }

  /**
   * Deletes a credential by ID.
   */
  public async delete(id: string): Promise<void> {
    const sql = `DELETE FROM credentials WHERE id = ?;`;
    await this.dbService.run(sql, [id]);
  }

  /**
   * Transactionally restores credentials replacing all existing entries.
   * If any error occurs, rolls back transaction to preserve the original vault data intact.
   */
  public async restoreAll(credentials: Credential[]): Promise<void> {
    await this.dbService.beginTransaction();
    try {
      // Clear existing records
      await this.dbService.run('DELETE FROM credentials;');

      const insertSql = `
        INSERT INTO credentials (id, name, username, password, website_url, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `;

      for (const cred of credentials) {
        await this.dbService.run(insertSql, [
          cred.id,
          cred.name,
          cred.username,
          cred.password,
          cred.websiteUrl || null,
          cred.notes || null,
          cred.createdAt,
          cred.updatedAt
        ]);
      }

      await this.dbService.commitTransaction();
    } catch (err) {
      await this.dbService.rollbackTransaction().catch(() => {});
      throw err;
    }
  }

  private mapRowToCredential(row: CredentialRow): Credential {
    return {
      id: row.id,
      name: row.name,
      username: row.username,
      password: row.password,
      websiteUrl: row.website_url || undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
