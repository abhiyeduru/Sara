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
      {Mascot ? (
        <Mascot
          directions={directions}
          reactions={reactions}
          size={size}
          label={label || key}
        />
      ) : (
        <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-sara-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
          {fallbackLetter}
        </div>
      )}
    </div>
  );
}

