package com.darthleonard.dokho;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Enforce FLAG_SECURE: blocks screenshots, screen recording, and recent-apps preview
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        registerPlugin(VaultSecurityPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
