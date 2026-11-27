package com.rivibe.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.rivibe.app.nativeaudio.RiVibeNativeMusicPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RiVibeNativeMusicPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
