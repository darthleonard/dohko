package com.darthleonard.dokho;

import android.content.Context;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.WindowManager;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.security.KeyStore;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "VaultSecurity")
public class VaultSecurityPlugin extends Plugin {

    private static final String KEY_ALIAS = "VaultBiometricMasterKey";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String BIO_PAYLOAD_FILE = "vault_bio.dat";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int GCM_IV_LENGTH = 12;

    @PluginMethod
    public void setSecure(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        getActivity().runOnUiThread(() -> {
            if (enabled) {
                getActivity().getWindow().setFlags(
                        WindowManager.LayoutParams.FLAG_SECURE,
                        WindowManager.LayoutParams.FLAG_SECURE
                );
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
            call.resolve(new JSObject().put("secure", enabled));
        });
    }

    @PluginMethod
    public void checkBiometrics(PluginCall call) {
        Context context = getContext();
        BiometricManager biometricManager = BiometricManager.from(context);
        int canAuth = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);

        boolean isAvailable = (canAuth == BiometricManager.BIOMETRIC_SUCCESS);
        boolean isEnrolled = false;
        File bioFile = new File(context.getFilesDir(), BIO_PAYLOAD_FILE);

        if (bioFile.exists()) {
            try {
                KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
                keyStore.load(null);
                isEnrolled = keyStore.containsAlias(KEY_ALIAS);
            } catch (Exception e) {
                isEnrolled = false;
            }
        }

        JSObject ret = new JSObject();
        ret.put("isAvailable", isAvailable);
        ret.put("isEnrolled", isEnrolled);
        ret.put("status", canAuth);
        call.resolve(ret);
    }

    @PluginMethod
    public void enrollBiometrics(PluginCall call) {
        String tokenB64 = call.getString("token");
        if (tokenB64 == null || tokenB64.isEmpty()) {
            call.reject("Token payload is required for biometric wrapping");
            return;
        }

        byte[] tokenBytes;
        try {
            tokenBytes = Base64.decode(tokenB64, Base64.NO_WRAP);
        } catch (Exception e) {
            call.reject("Invalid base64 token payload");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                KeyGenerator keyGenerator = KeyGenerator.getInstance(
                        KeyProperties.KEY_ALGORITHM_AES,
                        ANDROID_KEYSTORE
                );

                KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                        KEY_ALIAS,
                        KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
                )
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                        .setKeySize(256)
                        .setUserAuthenticationRequired(true);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    builder.setInvalidatedByBiometricEnrollment(true);
                }

                keyGenerator.init(builder.build());
                SecretKey secretKey = keyGenerator.generateKey();

                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, secretKey);

                Executor executor = ContextCompat.getMainExecutor(getContext());
                FragmentActivity activity = (FragmentActivity) getActivity();

                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle("Enable Biometric Unlock")
                        .setSubtitle("Confirm your biometric to protect the vault key")
                        .setNegativeButtonText("Cancel")
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                        .build();

                BiometricPrompt biometricPrompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        try {
                            BiometricPrompt.CryptoObject cryptoObject = result.getCryptoObject();
                            if (cryptoObject == null || cryptoObject.getCipher() == null) {
                                call.reject("Biometric crypto object is null");
                                return;
                            }
                            Cipher authenticatedCipher = cryptoObject.getCipher();
                            byte[] ciphertext = authenticatedCipher.doFinal(tokenBytes);
                            byte[] iv = authenticatedCipher.getIV();

                            File bioFile = new File(getContext().getFilesDir(), BIO_PAYLOAD_FILE);
                            try (FileOutputStream fos = new FileOutputStream(bioFile)) {
                                ByteBuffer buffer = ByteBuffer.allocate(4 + iv.length + ciphertext.length);
                                buffer.putInt(iv.length);
                                buffer.put(iv);
                                buffer.put(ciphertext);
                                fos.write(buffer.array());
                            }

                            JSObject res = new JSObject();
                            res.put("success", true);
                            call.resolve(res);
                        } catch (Exception e) {
                            call.reject("Failed to encrypt token with biometric key: " + e.getMessage());
                        }
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        deleteBiometricData();
                        JSObject err = new JSObject();
                        err.put("success", false);
                        err.put("cancelled", errorCode == BiometricPrompt.ERROR_USER_CANCELED || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON);
                        err.put("error", errString.toString());
                        call.resolve(err);
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                    }
                });

                biometricPrompt.authenticate(promptInfo, new BiometricPrompt.CryptoObject(cipher));

            } catch (Exception e) {
                deleteBiometricData();
                call.reject("Failed to initialize biometric enrollment: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void unlockWithBiometrics(PluginCall call) {
        File bioFile = new File(getContext().getFilesDir(), BIO_PAYLOAD_FILE);
        if (!bioFile.exists()) {
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("enrolled", false);
            res.put("error", "Biometric unlock not enrolled");
            call.resolve(res);
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                byte[] fileData = new byte[(int) bioFile.length()];
                try (FileInputStream fis = new FileInputStream(bioFile)) {
                    int read = fis.read(fileData);
                    if (read < 16) {
                        deleteBiometricData();
                        JSObject res = new JSObject();
                        res.put("success", false);
                        res.put("enrolled", false);
                        res.put("error", "Corrupt biometric payload");
                        call.resolve(res);
                        return;
                    }
                }

                ByteBuffer buffer = ByteBuffer.wrap(fileData);
                int ivLength = buffer.getInt();
                if (ivLength != GCM_IV_LENGTH) {
                    deleteBiometricData();
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put("enrolled", false);
                    res.put("error", "Invalid IV length");
                    call.resolve(res);
                    return;
                }
                byte[] iv = new byte[ivLength];
                buffer.get(iv);
                byte[] ciphertext = new byte[buffer.remaining()];
                buffer.get(ciphertext);

                KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
                keyStore.load(null);
                if (!keyStore.containsAlias(KEY_ALIAS)) {
                    deleteBiometricData();
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put("enrolled", false);
                    res.put("error", "Biometric key alias not found");
                    call.resolve(res);
                    return;
                }

                SecretKey secretKey = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");

                try {
                    cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
                } catch (KeyPermanentlyInvalidatedException e) {
                    deleteBiometricData();
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put("invalidated", true);
                    res.put("error", "Biometric credentials changed. Please unlock with master password.");
                    call.resolve(res);
                    return;
                }

                Executor executor = ContextCompat.getMainExecutor(getContext());
                FragmentActivity activity = (FragmentActivity) getActivity();

                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle("Unlock Vault")
                        .setSubtitle("Use your biometric credential to unlock")
                        .setNegativeButtonText("Use Master Password")
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                        .build();

                BiometricPrompt biometricPrompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        try {
                            BiometricPrompt.CryptoObject cryptoObject = result.getCryptoObject();
                            if (cryptoObject == null || cryptoObject.getCipher() == null) {
                                call.reject("CryptoObject is null");
                                return;
                            }
                            Cipher authenticatedCipher = cryptoObject.getCipher();
                            byte[] decrypted = authenticatedCipher.doFinal(ciphertext);

                            JSObject res = new JSObject();
                            res.put("success", true);
                            res.put("token", Base64.encodeToString(decrypted, Base64.NO_WRAP));
                            call.resolve(res);
                        } catch (Exception e) {
                            call.reject("Decryption failed: " + e.getMessage());
                        }
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        JSObject res = new JSObject();
                        res.put("success", false);
                        res.put("cancelled", errorCode == BiometricPrompt.ERROR_USER_CANCELED || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON);
                        res.put("error", errString.toString());
                        call.resolve(res);
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                    }
                });

                biometricPrompt.authenticate(promptInfo, new BiometricPrompt.CryptoObject(cipher));

            } catch (Exception e) {
                call.reject("Biometric unlock error: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void disableBiometrics(PluginCall call) {
        deleteBiometricData();
        JSObject res = new JSObject();
        res.put("success", true);
        call.resolve(res);
    }

    private void deleteBiometricData() {
        try {
            File bioFile = new File(getContext().getFilesDir(), BIO_PAYLOAD_FILE);
            if (bioFile.exists()) {
                bioFile.delete();
            }
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS);
            }
        } catch (Exception ignored) {
        }
    }
}
