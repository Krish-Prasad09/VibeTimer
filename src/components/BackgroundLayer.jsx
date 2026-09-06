import React from 'react';

const BackgroundLayer = ({ backgroundType }) => {
  if (!backgroundType || backgroundType === 'none') {
    return null;
  }

  let bgClass = '';
  switch (backgroundType) {
    case 'aurora':
      bgClass = 'bg-scene-aurora';
      break;
    case 'matrix':
      bgClass = 'bg-scene-matrix';
      break;
    case 'breathe':
      bgClass = 'bg-scene-breathe';
      break;
    default:
      return null;
  }

  return (
    <div className={`fixed inset-0 z-[-1] ${bgClass}`}></div>
  );
};

export default BackgroundLayer;
