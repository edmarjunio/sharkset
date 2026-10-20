type SportBallIconProps = {
  sport: 'futevolei' | 'beach-tennis' | 'volei-praia';
};

export function SportBallIcon({ sport }: SportBallIconProps) {
  const clipId = `sport-ball-${sport}`;
  const isBeachTennis = sport === 'beach-tennis';
  const isBeachVolleyball = sport === 'volei-praia';

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
      viewBox="0 0 32 32"
      fill="none"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="16" cy="16" r="14" />
        </clipPath>
        <radialGradient id={`${clipId}-shine`} cx="30%" cy="20%" r="85%">
          <stop stopColor="#fff" stopOpacity=".75" />
          <stop offset=".38" stopColor="#fff" stopOpacity=".12" />
          <stop offset="1" stopColor="#001729" stopOpacity=".32" />
        </radialGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {isBeachTennis ? (
          <>
            <circle cx="16" cy="16" r="14" fill="#050505" />
            <path d="M4.3 9.2C7 3.6 12.3 1.5 19.4 2.4c4.4.6 8.1 3.3 10.5 7.1L18.5 13c-1.5 3.3-1 7.2-2.6 10.3-2.4 4.6-7.8 5.5-11.5 2.5C.8 22.8 1 15.8 4.3 9.2Z" fill="#f1684b" />
            <path d="M18.4 12.1c3.5-1.3 7.2-2.5 11.5-2.6 3.1 5.1 2 12.1-2.5 16.9-4.7 5.1-13.8 5.7-19.2 1.1 8.5.3 11.5-4.6 10.2-15.4Z" fill="#b9dc31" />
            <path d="M18.5 12.2c-1.6 4.6-.2 9.3-3.7 13.4-3.2 3.7-8.2 3.8-11.3.2" stroke="#050505" strokeWidth="2.1" />
            <path d="M5 17.3c2.2-6.2 7.3-10 14-11" stroke="#050505" strokeWidth="1.15" strokeLinecap="round" />
            <path d="M23.1 25.3c3.2-3.1 4.6-7 4.2-11.2" stroke="#050505" strokeWidth=".9" strokeLinecap="round" />
          </>
        ) : isBeachVolleyball ? (
          <>
            <circle cx="16" cy="16" r="14" fill="#f7fbff" />
            <path d="M1.8 11.2c5.1-2.3 11.5-2.5 17-.5 4 1.4 8.1 4 11.1 7.2l-2.2 7.3c-4.4-4.2-9.4-6.1-14.2-5.8-4.4.2-8.2 2.2-11.3 5.6-2.6-4-2.7-9.8-.4-13.8Z" fill="#12549b" />
            <path d="M5 3.3c5.3 2 9.1 5.8 11 10.3 1.9 4.7 1.4 10.2-1.2 16.2l-7.1-.9c2.3-5.5 2.1-10.2.1-13.9C5.9 11.5 3 9.1.1 7.4L5 3.3Z" fill="#f4bd19" />
            <path d="M19.4 2.7c-.5 5.6 1.4 10.4 5.4 14.1 2 1.9 4.2 3.3 6.9 4.2l-2.8 7.1c-5.5-1.6-9.8-4.8-12.6-9.3-2.2-3.6-3.1-7.9-2.7-12.8l5.8-3.3Z" fill="#f7fbff" />
            <path d="M2.7 10.9c5.2-2.1 10.6-2.1 16.1-.2m-11-7c4.7 3.5 7.5 8.1 8.2 13.5m3.7-13.6c-.6 5.3 1.2 10.2 5.2 14" stroke="#dce9f5" strokeWidth=".85" />
          </>
        ) : (
          <>
            <circle cx="16" cy="16" r="14" fill="#ffc900" />
            <path d="m16 4.3 3.1 5.2 6.1.2-3.7 4.8 2.1 5.8-5.8-1.8L13 22l.1-6.1-5-3.4 5.8-1.7L16 4.3Z" fill="#05080d" />
            <path d="M2.4 9.8 7.9 8l5.1 4.3-1.5 5.9-6.2 2.1-4-5.1 1.1-5.4Zm22.2.8 4.1-4.3 4.6 4.6-.7 6.3-5.5 2.5-4.2-4.8 1.7-4.3ZM8 24l4.5-4.5 6.1.6 2.8 5.6-4.9 4.3-6.7-1.4L8 24Z" fill="#05080d" />
          </>
        )}
        <circle cx="16" cy="16" r="14" fill={`url(#${clipId}-shine)`} />
      </g>
      <circle cx="16" cy="16" r="14" stroke={isBeachTennis ? '#050505' : '#e7f8ff'} strokeOpacity={isBeachTennis ? '1' : '.72'} strokeWidth={isBeachTennis ? '1.8' : '.8'} />
    </svg>
  );
}
