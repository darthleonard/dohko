export interface Migration {
  version: number;
  statements: string[];
}

export const DATABASE_VERSION = 1;
export const DATABASE_NAME = 'dohko_vault.db';

export const DATABASE_MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        website_url TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_credentials_name ON credentials (name);`,
      `CREATE INDEX IF NOT EXISTS idx_credentials_username ON credentials (username);`
    ]
  }
];
