const MapContainer = () => {
  // ... existing code ...

  const renderAdMarker = (post) => {
    const { isAd, borderColor } = post;
    return (
      <div>
        {isAd ? `\n          <div style="position: relative; transform: translate(-50%, -100%)">\n            <div class="${isPopular ? 'popular-border-container animate-popular-glow' : ''}" style="width: 56px; height: 56px; border-radius: 16px; ${!isPopular ? `border: 4px solid ${borderColor};` : 'padding: 4px;'}">\n              <img src="${post.image}" alt="ad" class="w-full h-full object-cover" />\n            </div>\n          </div>` : ''
        }
      </div>
    );
  };

  // ... rest of the component ...
};
export default MapContainer;