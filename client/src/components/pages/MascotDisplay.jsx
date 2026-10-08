import React from 'react';
import { Mascot } from 'page-mascot';

export default function MascotDisplay({ mascotKey = 'glasses', size = 88, label, fallbackLetter = 'A', color }) {
  const key = mascotKey || 'glasses';
  const directions = `/mascots/${key}-directions.webp`;
  const reactions = `/mascots/${key}-reactions.webp`;

  return (
    <div
      style={{
        width: size,
        height: size,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'visible'
      }}
    >
      <Mascot
        directions={directions}
        reactions={reactions}
        size={size}
        label={label || key}
      />
    </div>
  );
}

