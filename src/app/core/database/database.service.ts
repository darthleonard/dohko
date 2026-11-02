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
    const totalLabel = `[DatabaseService] Total openDatabase`;
    console.time(totalLabel);
    console.log(`[DatabaseService] Starting openDatabase at ${new Date().toISOString()}`);

    if (this.isOpen && this.dbConnection) {
      console.log(`[DatabaseService] Database already open and connection exists, returning immediately.`);
      console.timeEnd(totalLabel);
      return;
    }

    const isNative = Capacitor.isNativePlatform();
    let clearSecretOnFailure = false;

    try {
      if (isNative) {
        const secretStatus = await CapacitorSQLite.isSecretStored();
        if (secretStatus.result) {
          const secretMatches = await CapacitorSQLite.checkEncryptionSecret({
            passphrase: sqlCipherKey,
          });
          if (!secretMatches.result) {
            throw new Error(
              'The stored SQLCipher passphrase does not match the unlocked vault.',
            );
          }
          clearSecretOnFailure = true;
        } else {
          clearSecretOnFailure = true;
          await CapacitorSQLite.setEncryptionSecret({
            passphrase: sqlCipherKey,
          });
        }

        // Check if connection exists in connection pool
        const timerIsConn = `[DatabaseService] sqliteConnection.isConnection`;
        console.time(timerIsConn);
        console.log(`[DatabaseService] Starting isConnection at ${new Date().toISOString()}`);
        let isConn = false;
        try {
          const res = await this.sqliteConnection.isConnection(DATABASE_NAME, false);
          isConn = res.result || false;
          console.log(`[DatabaseService] Completed isConnection (result=${isConn}) at ${new Date().toISOString()}`);
        } catch (err) {
          console.error(`[DatabaseService] Error in isConnection:`, err);
          throw err;
        } finally {
          console.timeEnd(timerIsConn);
        }

        if (isConn) {
          const timerRetrieve = `[DatabaseService] sqliteConnection.retrieveConnection`;
          console.time(timerRetrieve);
          console.log(`[DatabaseService] Starting retrieveConnection at ${new Date().toISOString()}`);
          try {
            this.dbConnection = await this.sqliteConnection.retrieveConnection(DATABASE_NAME, false);
            console.log(`[DatabaseService] Completed retrieveConnection at ${new Date().toISOString()}`);
          } catch (err) {
            console.error(`[DatabaseService] Error in retrieveConnection:`, err);
            throw err;
          } finally {
            console.timeEnd(timerRetrieve);
          }
        } else {
          const timerCreate = `[DatabaseService] sqliteConnection.createConnection`;
          console.time(timerCreate);
          console.log(`[DatabaseService] Starting createConnection at ${new Date().toISOString()}`);
          try {
            this.dbConnection = await this.sqliteConnection.createConnection(
              DATABASE_NAME,
              true, // encrypted
              'secret',
              DATABASE_VERSION,
              false // readonly
            );
            console.log(`[DatabaseService] Completed createConnection at ${new Date().toISOString()}`);
          } catch (err) {
            console.error(`[DatabaseService] Error in createConnection:`, err);
            throw err;
          } finally {
            console.timeEnd(timerCreate);
          }
        }

        const timerOpen = `[DatabaseService] dbConnection.open`;
        console.time(timerOpen);
        console.log(`[DatabaseService] Starting dbConnection.open at ${new Date().toISOString()}`);
        try {
          await this.dbConnection.open();
          console.log(`[DatabaseService] Completed dbConnection.open at ${new Date().toISOString()}`);
        } catch (err) {
          console.error(`[DatabaseService] Error in dbConnection.open:`, err);
          throw err;
        } finally {
          console.timeEnd(timerOpen);
        }

        // Mandatory Security Verification: verify SQLCipher is actively loaded and encrypting
        const timerVerify = `[DatabaseService] verifySqlCipherEncryption`;
        console.time(timerVerify);
        console.log(`[DatabaseService] Starting verifySqlCipherEncryption at ${new Date().toISOString()}`);
        try {
          await this.verifySqlCipherEncryption();
          console.log(`[DatabaseService] Completed verifySqlCipherEncryption at ${new Date().toISOString()}`);
        } catch (err) {
          console.error(`[DatabaseService] Error in verifySqlCipherEncryption:`, err);
          throw err;
        } finally {
          console.timeEnd(timerVerify);
        }

      } else {
        // Non-native / Web environment support
        const timerIsConn = `[DatabaseService] sqliteConnection.isConnection (web)`;
        console.time(timerIsConn);
        console.log(`[DatabaseService] Starting isConnection (web) at ${new Date().toISOString()}`);
        let isConn = false;
        try {
          const res = await this.sqliteConnection.isConnection(DATABASE_NAME, false);
          isConn = res.result || false;
          console.log(`[DatabaseService] Completed isConnection (web, result=${isConn}) at ${new Date().toISOString()}`);
        } catch (err) {
          console.error(`[DatabaseService] Error in isConnection (web):`, err);
          throw err;
        } finally {
          console.timeEnd(timerIsConn);
        }

        if (isConn) {
          const timerRetrieve = `[DatabaseService] sqliteConnection.retrieveConnection (web)`;
          console.time(timerRetrieve);
          try {
            this.dbConnection = await this.sqliteConnection.retrieveConnection(DATABASE_NAME, false);
          } finally {
            console.timeEnd(timerRetrieve);
          }
        } else {
          const timerCreate = `[DatabaseService] sqliteConnection.createConnection (web)`;
          console.time(timerCreate);
          try {
            this.dbConnection = await this.sqliteConnection.createConnection(
              DATABASE_NAME,
              false,
              'no-encryption',
              DATABASE_VERSION,
              false
            );
          } finally {
            console.timeEnd(timerCreate);
          }
        }

        const timerOpen = `[DatabaseService] dbConnection.open (web)`;
        console.time(timerOpen);
        try {
          await this.dbConnection.open();
        } finally {
          console.timeEnd(timerOpen);
        }
      }

      this.isOpen = true;

      // Run database migrations/schema setup
      const timerMigrations = `[DatabaseService] runMigrations`;
      console.time(timerMigrations);
      console.log(`[DatabaseService] Starting runMigrations at ${new Date().toISOString()}`);
      try {
        await this.runMigrations();
        console.log(`[DatabaseService] Completed runMigrations at ${new Date().toISOString()}`);
      } catch (err) {
        console.error(`[DatabaseService] Error in runMigrations:`, err);
        throw err;
      } finally {
        console.timeEnd(timerMigrations);
      }

    } catch (err: unknown) {
      this.isOpen = false;
      this.dbConnection = null;
      if (isNative && clearSecretOnFailure) {
        await CapacitorSQLite.clearEncryptionSecret().catch(() => {});
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to open encrypted database: ${message}`);
    } finally {
      console.timeEnd(totalLabel);
      console.log(`[DatabaseService] Finished openDatabase at ${new Date().toISOString()}`);
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
    const timer = `[DatabaseService] SQLCipher PRAGMA cipher_version query`;
    console.time(timer);
    try {
      const res = await this.dbConnection!.query('PRAGMA cipher_version;');
      const rows = res.values || [];
      if (rows.length === 0 || !rows[0].cipher_version) {
        throw new Error('PRAGMA cipher_version returned empty. SQLCipher is not active.');
      }
      console.log(`[DatabaseService] SQLCipher active, cipher_version=${rows[0].cipher_version}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`SQLCipher encryption verification failed: ${msg}. Aborting to protect data.`);
    } finally {
      console.timeEnd(timer);
    }
  }

  /**
   * Applies schema migrations sequentially.
   */
  private async runMigrations(): Promise<void> {
    for (let mIdx = 0; mIdx < DATABASE_MIGRATIONS.length; mIdx++) {
      const migration = DATABASE_MIGRATIONS[mIdx];
      console.log(`[DatabaseService] Running migration v${migration.version} (${mIdx + 1}/${DATABASE_MIGRATIONS.length})`);
      for (let sIdx = 0; sIdx < migration.statements.length; sIdx++) {
        const statement = migration.statements[sIdx];
        const stmtTimer = `[DatabaseService] Migration v${migration.version} stmt ${sIdx + 1}`;
        console.time(stmtTimer);
        try {
          await this.dbConnection!.execute(statement);
        } catch (err) {
          console.error(`[DatabaseService] Error in migration statement: ${statement}`, err);
          throw err;
        } finally {
          console.timeEnd(stmtTimer);
        }
      }
    }
  }

  private assertOpen(): void {
    if (!this.isOpen || !this.dbConnection) {
      throw new Error('Database is locked or not opened.');
    }
  }
}
