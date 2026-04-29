import React, { memo } from 'react';

interface ShutterOverlayProps {
  active: boolean;
}

const ShutterOverlay = memo(({ active }: ShutterOverlayProps) => {
  if (!active) return null;
  return (
    <div className="shutter-overlay">
      <div className="shutter-flash" />
      <svg className="shutter-corner shutter-corner-tl" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 22 L4 4 L22 4" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <svg className="shutter-corner shutter-corner-tr" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 4 L40 4 L40 22" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <svg className="shutter-corner shutter-corner-bl" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 22 L4 40 L22 40" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <svg className="shutter-corner shutter-corner-br" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 40 L40 40 L40 22" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
});

export default ShutterOverlay;
