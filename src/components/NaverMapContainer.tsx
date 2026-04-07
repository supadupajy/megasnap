"use client";

import React from 'react';
import { NavermapsProvider, Container as MapDiv, NaverMap, Marker } from '@navermaps/react-naver-maps';

interface NaverMapContainerProps {
  children?: React.ReactNode;
  posts: any[];
}

const NaverMapContainer = ({ children, posts }: NaverMapContainerProps) => {
  // 기본 위치: 서울 시청 근처
  const defaultCenter = { lat: 37.5665, lng: 126.9780 };

  // 실제 서비스 시에는 사용자에게 Client ID를 입력받아야 합니다.
  // 여기서는 데모를 위해 빈 값을 넣거나 환경 변수를 사용하도록 구조를 잡습니다.
  const ncpClientId = ""; 

  if (!ncpClientId) {
    return (
      <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 max-w-xs">
          <p className="text-gray-600 mb-4 font-medium">
            네이버 지도 API 키(Client ID)가 필요합니다.
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Naver Cloud Platform에서 발급받은 Client ID를 NaverMapContainer.tsx 파일에 입력해주세요.
          </p>
        </div>
        {/* API 키가 없을 때 보여줄 대체 배경 (기존 이미지) */}
        <img 
          src="https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=1200" 
          alt="map placeholder" 
          className="absolute inset-0 w-full h-full object-cover opacity-20 -z-10"
        />
      </div>
    );
  }

  return (
    <NavermapsProvider ncpClientId={ncpClientId}>
      <MapDiv className="w-full h-full">
        <NaverMap
          defaultCenter={defaultCenter}
          defaultZoom={15}
          mapDataControl={false}
        >
          {posts.map((post) => (
            <Marker
              key={post.id}
              position={{ lat: post.lat, lng: post.lng }}
              title={post.location}
              // 커스텀 마커 이미지를 사용할 수 있습니다.
              icon={{
                content: `
                  <div style="cursor:pointer;">
                    <div style="width:56px; height:56px; border-radius:16px; border:4px solid white; box-shadow:0 4px 12px rgba(0,0,0,0.15); overflow:hidden; background:#eee;">
                      <img src="${post.image}" style="width:100%; height:100%; object-fit:cover;" />
                    </div>
                    <div style="position:absolute; bottom:-4px; left:50%; transform:translateX(-50%); width:12px; height:12px; background:white; transform:rotate(45deg); box-shadow:1px 1px 2px rgba(0,0,0,0.05);"></div>
                  </div>
                `,
                anchor: { x: 28, y: 56 }
              }}
            />
          ))}
        </NaverMap>
      </MapDiv>
    </NavermapsProvider>
  );
};

export default NaverMapContainer;