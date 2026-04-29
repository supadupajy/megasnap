import React, { memo } from 'react';

interface ShutterOverlayProps {
  active: boolean;
}

const ShutterOverlay = memo(({ active }: ShutterOverlayProps) => {
  if (!active) return null;
  return (
    <div className="shutter-overlay">
      <div className="shutter-flash" />
    </div>
  );
});

export default ShutterOverlay;
