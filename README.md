# Dohko

Dohko is a password vault built with Angular, Ionic, and Capacitor. Vault data is
stored locally in an encrypted SQLite database, with encrypted backups that can
be exported and restored from a `.vault` file.

## Features

- Create and unlock a vault with a master password.
- Add, edit, search, and delete saved credentials.
- Store vault records locally in SQLCipher-encrypted SQLite.
- Derive keys with Argon2id and use AES-256-GCM for key wrapping and encrypted
  backups.
- Change the master password without re-encrypting every credential.
- Export and restore a password-protected backup.
- Configure auto-lock, password visibility, and clipboard clearing timers.
- Optional biometric unlock using the Android Keystore.
- English (US) and Spanish (Mexico) interface translations.

## Security notes

- Your master password is not stored in plaintext. Dohko derives a key from it
  and uses that key to wrap the vault's data encryption key.
- Forgetting the master password means the vault cannot be unlocked. Keep
  backups in a secure location.
- Backup export uses a separate password (at least 8 characters). Keep it
  separate from the backup file; it is required to restore the backup.
- Restoring a backup replaces the credentials currently in the vault.
- Protect exported `.vault` files as sensitive data, even though their contents
  are encrypted.

Review the implementation and assess your own security requirements before
storing sensitive information. Security features do not protect against a
compromised device or weak passwords.

## Requirements

- Node.js 22
- npm
- For Android development: Android Studio and Java 21
- Ionic CLI for the `run.android` script

## Getting started

Install dependencies:

```sh
npm ci
```

Start the web development server:

```sh
npm start
```

Build the web application:

```sh
npm run build
```

Run the unit tests:

```sh
npm test -- --watch=false
```

Run lint:

```sh
npm run lint
```

## Android

The `run.android` script builds the web app, syncs Capacitor assets and plugins,
and opens the Android project:

```sh
npm run run.android
```

Alternatively, build and sync without opening Android Studio:

```sh
npm run build
npx cap sync android
```

Then open the `android` directory in Android Studio to run the app on a device
or emulator.

## Backups

Exports use the `.vault` extension and contain a versioned backup structure with
Argon2id key-derivation parameters and AES-256-GCM encrypted credential data.
The backup password is independent of the vault's master password. Import checks
the selected file's size and format before prompting for its password.

## Project layout

```text
src/app/core/auth/        Vault setup, unlock, and session management
src/app/core/crypto/      Key derivation and cryptographic operations
src/app/core/database/    SQLCipher database and credential repository
src/app/core/backup/      Encrypted backup format, validation, import/export
src/app/features/         Onboarding, unlock, credentials, and settings UI
android/                  Native Android project
.github/workflows/        Build, test, and Android bundle workflow
```

## Continuous integration

The GitHub Actions workflow runs the test suite, builds the Ionic app, syncs
Capacitor for Android, and generates a signed Android App Bundle. The signing
step requires the Android signing secrets configured in the repository's GitHub
Actions settings.

The automated tests currently cover selected unit and component behavior. They
do not replace end-to-end testing on Android devices or database integration
testing.
