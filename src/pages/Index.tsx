...
        {/* 재검색 버튼이 항상 보이도록 유지 */}
        <div className="pointer-events-auto">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-xl border border-gray-100 text_
```

I will continue.

```tsx
-green-600 font-bold text-sm hover:bg-white active:scale-95 transition-all whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '교체 중...' : '재검색'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!isAnyPopupOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <TimeSlider value={timeRange} onChange={setTimeRange} />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative w-full h-full pt-14 pb-20 overflow-hidden">
        <MapContainer 
          posts={visiblePosts} 
          viewedPostIds={viewedPostIds}
          onMarkerClick={handlePostSelect}
          onMapChange={handleMapChange}
          onMapWriteClick={() => setIsWriteOpen(true)}
          center={mapCenter}
        />
      </main>

      <div className="fixed bottom-[200px] left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="relative w-full h-full">
          <motion.button
            onClick={() => setIsPlaceSearchOpen(true)}
            animate={{ opacity: isSheetOpen ? 0 : 1, y: isSheetOpen ? 20 : 0 }}
            className="pointer-events-auto absolute left-0 bottom-0 h-10 px-3 bg-white rounded-xl shadow-xl flex items-center gap-2 text-gray-700 active:scale-90 transition-transform border border-gray-100"
          >
            <Search className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">장소 검색</span>
          </motion.button>

          <motion.button 
            onClick={handleCurrentLocation}
            animate={{ opacity: isSheetOpen ? 0 : 1, y: isSheetOpen ? 20 : 0 }}
            className="pointer-events-auto absolute right-[-4px] bottom-0 w-10 h-10 bg-white rounded-xl shadow-xl flex items-center justify-center text-green-500 active:scale-90 transition-transform border border-gray-100"
          >
            <Navigation className="w-5 h-5 fill-current" />
          </motion.button>
        </div>
      </div>

      <motion.div 
        initial={false}
        animate={{ 
          y: isSheetOpen ? "10%" : "calc(100% - 180px)" 
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-40 pointer-events-none"
      >
        <div className="absolute inset-x-0 bottom-0 h-full bg-white rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.1)] pointer-events-auto flex flex-col">
          <div 
            className="w-full pt-4 pb-6 flex flex-col items-center cursor-pointer sticky top-0 bg-white z-10 rounded-t-[32px] border-b border-gray-50"
            onClick={() => setIsSheetOpen(!isSheetOpen)}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4" />
            <div className="flex items-center gap-1 text-gray-500">
              <ChevronUp className={`w-4 h-4 transition-transform duration-300 ${isSheetOpen ? 'rotate-180' : ''}`} />
              <span className="text-sm font-bold">주변 게시물 ({visiblePosts.length})</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-40">
            <AnimatePresence mode="wait">
              {isRefreshing ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
                  <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm text-gray-400">새로운 장소를 찾는 중...</p>
                </motion.div>
              ) : visiblePosts.length > 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="divide-y divide-gray-50">
                  {visiblePosts.map(post => (
                    <div key={post.id} onClick={() => handlePostSelect(post)}>
                      <PostItem {...post} />
                    </div>
                  ))}
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <p className="font-medium">게시물이 없습니다.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <PostDetail post={selectedPost} isOpen={!!selectedPost} onClose={() => setSelectedPost(null)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
      <PlaceSearch 
        isOpen={isPlaceSearchOpen} 
        onClose={() => setIsPlaceSearchOpen(false)} 
        onSelect={handlePlaceSelect} 
      />
    </div>
  );
};

export default Index;