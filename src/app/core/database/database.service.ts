import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection
} from '@capacitor-community/sqlite';
import { DATABASE_MIGRATIONS, DATABASE_NAME, DATABASE_VERSION } from './database-migrations';

/**
 * DatabaseService
 *
 * Manages the local SQLite database encrypted with SQLCipher via @capacitor-community/sqlite.
 *
 * Security Features:
 * - Full database encryption at rest using SQLCipher (AES-256).
 * - Verifies that SQLCipher encryption is active via `PRAGMA cipher_version`.
 * - Sets the encryption passphrase in SharedPreferences before opening the connection.
 *   The secret is retained in SharedPreferences for the duration of the unlocked session
 *   and is cleared in `closeDatabase()` when the vault is locked, ensuring it is never
 *   retained at rest. Clearing it immediately after open caused "No available connection"
 *   on first-run vault creation because SQLCipher needs the key available during DB creation.
 * - Enforces database closure and memory cleanup upon vault lock.
 */
@Injectable({
  providedIn: 'root'
})
export class DatabaseService {

  private sqliteConnection: SQLiteConnection;
  private dbConnection: SQLiteDBConnection | null = null;
  private isOpen = false;

  constructor() {
    this.sqliteConnection = new SQLiteConnection(CapacitorSQLite);
  }

  /**
   * Returns whether the database connection is currently open.
   */
  public isDatabaseOpen(): boolean {
    return this.isOpen && this.dbConnection !== null;
  }

  /**
   * Initializes and opens the encrypted SQLCipher database.
   *
   * @param sqlCipherKey 64-character hex key derived from 256-bit DEK
   */
  public async openDatabase(sqlCipherKey: string): Promise<void> {
    if (this.isOpen && this.dbConnection) {
      return;
    }

    const isNative = Capacitor.isNativePlatform();

    try {
      if (isNative) {
        // Supply key to SQLCipher for connection initialization
        await CapacitorSQLite.setEncryptionSecret({ passphrase: sqlCipherKey });

        // Check if connection exists in connection pool
        const isConn = (await this.sqliteConnection.isConnection(DATABASE_NAME, false)).result;
        if (isConn) {
          this.dbConnection = await this.sqliteConnection.retrieveConnection(DATABASE_NAME, false);
        } else {
          this.dbConnection = await this.sqliteConnection.createConnection(
            DATABASE_NAME,
            true, // encrypted
            'secret',
            DATABASE_VERSION,
            false // readonly
          );
        }

        await this.dbConnection.open();

        // Mandatory Security Verification: verify SQLCipher is actively loaded and encrypting
        await this.verifySqlCipherEncryption();

        // NOTE: clearEncryptionSecret() is intentionally NOT called here.
        // On first-run vault creation, SQLCipher needs the passphrase to remain in
        // SharedPreferences through the DB creation phase. Calling it immediately after
        // open() caused "No available connection for database dohko_vault" on first run.
        // The secret is cleared in closeDatabase() when the vault is locked, so it is
        // never persisted at rest across app restarts.

      } else {
        // Non-native / Web environment support
        const isConn = (await this.sqliteConnection.isConnection(DATABASE_NAME, false)).result;
        if (isConn) {
          this.dbConnection = await this.sqliteConnection.retrieveConnection(DATABASE_NAME, false);
        } else {
          this.dbConnection = await this.sqliteConnection.createConnection(
            DATABASE_NAME,
            false,
            'no-encryption',
            DATABASE_VERSION,
            false
          );
        }
        await this.dbConnection.open();
      }

      this.isOpen = true;

      // Run database migrations/schema setup
      await this.runMigrations();

    } catch (err: unknown) {
      this.isOpen = false;
      this.dbConnection = null;
      if (isNative) {
        await CapacitorSQLite.clearEncryptionSecret().catch(() => {});
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to open encrypted database: ${message}`);
    }
  }

  /**
   * Closes the database connection and clears internal handles.
   * Also clears the encryption secret from SharedPreferences so it is never persisted at rest.
   */
  public async closeDatabase(): Promise<void> {
    if (!this.isOpen && !this.dbConnection) {
      return;
    }

    try {
      if (this.dbConnection) {
        const isConn = (await this.sqliteConnection.isConnection(DATABASE_NAME, false)).result;
        if (isConn) {
          await this.sqliteConnection.closeConnection(DATABASE_NAME, false);
        }
      }
    } catch {
      // Ignore errors on close during emergency lock
    } finally {
      this.dbConnection = null;
      this.isOpen = false;
      // Clear the encryption secret from SharedPreferences on lock.
      // This is the correct place: the DB is now closed so the key is no longer needed.
      if (Capacitor.isNativePlatform()) {
        await CapacitorSQLite.clearEncryptionSecret().catch(() => {});
      }
    }
  }

  /**
   * Executes a parameterized query that returns rows.
   */
  public async query<T = any>(statement: string, values: any[] = []): Promise<T[]> {
    this.assertOpen();
    const res = await this.dbConnection!.query(statement, values);
    return (res.values as T[]) || [];
  }

  /**
   * Executes a statement that modifies data (INSERT, UPDATE, DELETE).
   */
  public async run(statement: string, values: any[] = []): Promise<{ changes: number; lastId?: number }> {
    this.assertOpen();
    const res = await this.dbConnection!.run(statement, values);
    return {
      changes: res.changes?.changes || 0,
      lastId: res.changes?.lastId
    };
  }

  /**
   * Executes arbitrary SQL statements.
   */
  public async execute(statements: string): Promise<void> {
    this.assertOpen();
    await this.dbConnection!.execute(statements);
  }

  /**
   * Transaction support
   */
  public async beginTransaction(): Promise<void> {
    this.assertOpen();
    await this.dbConnection!.beginTransaction();
  }

  public async commitTransaction(): Promise<void> {
    this.assertOpen();
    await this.dbConnection!.commitTransaction();
  }

  public async rollbackTransaction(): Promise<void> {
    this.assertOpen();
    await this.dbConnection!.rollbackTransaction();
  }

  /**
   * Verifies that SQLCipher is active by querying cipher_version.
   * Throws an error on Android if SQLCipher is not active.
   */
  private async verifySqlCipherEncryption(): Promise<void> {
    try {
      const res = await this.dbConnection!.query('PRAGMA cipher_version;');
      const rows = res.values || [];
      if (rows.length === 0 || !rows[0].cipher_version) {
        throw new Error('PRAGMA cipher_version returned empty. SQLCipher is not active.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`SQLCipher encryption verification failed: ${msg}. Aborting to protect data.`);
    }
  }

  /**
   * Applies schema migrations sequentially.
   */
  private async runMigrations(): Promise<void> {
    for (const migration of DATABASE_MIGRATIONS) {
      for (const statement of migration.statements) {
        await this.dbConnection!.execute(statement);
      }
    }
  }

  private assertOpen(): void {
    if (!this.isOpen || !this.dbConnection) {
      throw new Error('Database is locked or not opened.');
    }
  }
}
