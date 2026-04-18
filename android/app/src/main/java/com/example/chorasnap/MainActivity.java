package com.example.chorasnap;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        // 웹뷰에서 사용자 조작 없이도 소리가 포함된 미디어 자동 재생을 허용합니다.
        WebSettings settings = this.bridge.getWebView().getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);
    }
}