package com.example.chora;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.kakao.vectormap.KakaoMapSdk;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 카카오 지도 SDK 초기화
        KakaoMapSdk.init(this, "79d8615ee18c3979de0b737fd62b2f90");
    }
}