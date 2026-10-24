import { Injectable } from '@angular/core';
import {
  BACKUP_FORMAT_IDENTIFIER,
  CURRENT_BACKUP_VERSION,
  DecryptedBackupPayload,
  EncryptedBackupFile,
  MAX_BACKUP_FILE_SIZE_BYTES,
  MAX_BACKUP_RECORDS_COUNT
} from './backup-format';
import { Credential } from '../database/credential.repository';

@Injectable({
  providedIn: 'root'
})
export class BackupValidator {

  private readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  /**
   * Validates raw backup file content before attempting decryption.
   */
  public validateFileStructure(fileContent: string): EncryptedBackupFile {
    if (!fileContent || typeof fileContent !== 'string') {
      throw new Error('Backup file is empty or invalid.');
    }

    if (fileContent.length > MAX_BACKUP_FILE_SIZE_BYTES) {
      throw new Error('Backup file exceeds maximum permitted size of 10 MB.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(fileContent);
    } catch {
      throw new Error('Backup file is not valid JSON.');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Backup content must be a JSON object.');
    }

    if (parsed.format !== BACKUP_FORMAT_IDENTIFIER) {
      throw new Error(`Invalid backup format identifier. Expected "${BACKUP_FORMAT_IDENTIFIER}".`);
    }

    if (parsed.version !== CURRENT_BACKUP_VERSION) {
      throw new Error(`Unsupported backup format version: ${parsed.version}.`);
    }

    if (!parsed.kdf || parsed.kdf.algorithm !== 'Argon2id' || !parsed.kdf.salt) {
      throw new Error('Malformed or missing KDF parameters in backup header.');
    }

    if (!parsed.encryption || parsed.encryption.algorithm !== 'AES-256-GCM' || !parsed.encryption.iv) {
      throw new Error('Malformed or missing encryption metadata in backup header.');
    }

    if (!parsed.ciphertext || typeof parsed.ciphertext !== 'string') {
      throw new Error('Malformed or missing ciphertext in backup file.');
    }

    return parsed as EncryptedBackupFile;
  }

  /**
   * Validates decrypted credential payload against strict schema.
   */
  public validateDecryptedPayload(payloadJson: string): Credential[] {
    let parsed: any;
    try {
      parsed = JSON.parse(payloadJson);
    } catch {
      throw new Error('Decrypted backup payload contains invalid JSON data.');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Decrypted payload must be an object.');
    }

    const payload = parsed as DecryptedBackupPayload;
    if (payload.schemaVersion !== 1) {
      throw new Error(`Unsupported payload schema version: ${payload.schemaVersion}.`);
    }

    if (!Array.isArray(payload.credentials)) {
      throw new Error('Decrypted payload missing credentials array.');
    }

    if (payload.credentials.length > MAX_BACKUP_RECORDS_COUNT) {
      throw new Error(`Backup contains ${payload.credentials.length} records, exceeding limit of ${MAX_BACKUP_RECORDS_COUNT}.`);
    }

    const validatedCredentials: Credential[] = [];

    for (let i = 0; i < payload.credentials.length; i++) {
      const item = payload.credentials[i];
      const validated = this.validateSingleCredential(item, i);
      validatedCredentials.push(validated);
    }

    return validatedCredentials;
  }

  private validateSingleCredential(item: any, index: number): Credential {
    if (!item || typeof item !== 'object') {
      throw new Error(`Record #${index + 1} is not a valid object.`);
    }

    if (!item.id || typeof item.id !== 'string' || !this.UUID_REGEX.test(item.id)) {
      throw new Error(`Record #${index + 1} has an invalid or missing UUID.`);
    }

    if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0 || item.name.length > 255) {
      throw new Error(`Record #${index + 1} (${item.id}) has an invalid name.`);
    }

    if (typeof item.username !== 'string' || item.username.length > 255) {
      throw new Error(`Record #${index + 1} (${item.name}) has an invalid username.`);
    }

    if (typeof item.password !== 'string' || item.password.length === 0 || item.password.length > 5000) {
      throw new Error(`Record #${index + 1} (${item.name}) has an invalid password.`);
    }

    if (item.websiteUrl !== undefined && item.websiteUrl !== null) {
      if (typeof item.websiteUrl !== 'string' || item.websiteUrl.length > 2048) {
        throw new Error(`Record #${index + 1} (${item.name}) has an invalid website URL.`);
      }
    }

    if (item.notes !== undefined && item.notes !== null) {
      if (typeof item.notes !== 'string' || item.notes.length > 10000) {
        throw new Error(`Record #${index + 1} (${item.name}) has notes exceeding maximum length.`);
      }
    }

    if (!item.createdAt || isNaN(Date.parse(item.createdAt))) {
      throw new Error(`Record #${index + 1} (${item.name}) has an invalid createdAt timestamp.`);
    }

    if (!item.updatedAt || isNaN(Date.parse(item.updatedAt))) {
      throw new Error(`Record #${index + 1} (${item.name}) has an invalid updatedAt timestamp.`);
    }

    return {
      id: item.id,
      name: item.name.trim(),
      username: item.username.trim(),
      password: item.password,
      websiteUrl: item.websiteUrl ? item.websiteUrl.trim() : undefined,
      notes: item.notes ? item.notes.trim() : undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}
