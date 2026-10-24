import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.darthleonard.dokho',
  appName: 'dohko',
  webDir: 'www',
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: true,
      androidBiometric: {
        biometricAuth: false
      }
    }
  }
};

export default config;
