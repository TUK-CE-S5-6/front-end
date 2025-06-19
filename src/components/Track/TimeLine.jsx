import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

// 시간 포맷
const formatTime = (seconds) => {
  const sec = Math.floor(seconds);
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const Timeline = () => {
  const timelineDuration = useSelector((state) => state.timelineDuration);
  const reduxTime = useSelector((state) => state.time); // 시작 기준
  const isPlaying = useSelector((state) => state.isPlaying);

  const timelineWidth = timelineDuration * 100;
  const numTicks = Math.ceil(timelineDuration * 10) + 1;
  const wrapperRef = useRef(null);

  const [localTime, setLocalTime] = useState(reduxTime); // 내부 재생 시간
  const animationRef = useRef(null);
  const startRef = useRef(null);
  
 
  // 재생 상태에 따라 시간 흐름 조절
  useEffect(() => {
    if (isPlaying === 1) {
      startRef.current = Date.now() - localTime * 1000;

      const update = () => {
        const elapsed = (Date.now() - startRef.current) / 1000;
        setLocalTime(Math.min(elapsed, timelineDuration));
        animationRef.current = requestAnimationFrame(update);
      };

      animationRef.current = requestAnimationFrame(update);
    } else {
      cancelAnimationFrame(animationRef.current);
      setLocalTime(reduxTime); // 정지 시 redux 시간 기준으로 맞춤
    }

    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, reduxTime, timelineDuration]);

  // 스크롤 동기화 (빨간 선 따라가기)
  useEffect(() => {
    if (wrapperRef.current) {
      const markerPos = localTime * 100;
      const viewWidth = wrapperRef.current.clientWidth;
      const scrollLeft = markerPos - viewWidth / 2;
      wrapperRef.current.scrollLeft = Math.max(0, scrollLeft);
    }
  }, [localTime]);

  // 눈금 생성
  const ticks = [];
  for (let i = 0; i < numTicks; i++) {
    const leftPos = i * 10;
    if (i % 10 === 0) {
      ticks.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: leftPos,
            bottom: 0,
            width: '1px',
            height: '10px',
            background: '#333',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '-20px',
              width: '40px',
              textAlign: 'center',
              fontSize: '10px',
            }}
          >
            {formatTime(i / 10)}
          </div>
        </div>
      );
    } else {
      ticks.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: leftPos,
            bottom: 0,
            width: '1px',
            height: '5px',
            background: '#666',
          }}
        />
      );
    }
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '40px',
        overflowX: 'auto',
        borderBottom: '1px solid #ccc',
        marginLeft: '200px',
      }}
    >
      <div style={{ position: 'relative', width: timelineWidth, height: '100%' }}>
        {ticks}

        {/* 🔴 현재 시간 빨간 선 */}
        <div
          style={{
            position: 'absolute',
            left: `${localTime * 100}px`,
            top: 0,
            width: '2px',
            height: '100vh', // ✅ 전체 화면 높이만큼 뻗게 함
            background: 'red',
            zIndex: 10,
          }}
        />


        {/* 🔴 현재 시간 텍스트 */}
        <div
          style={{
            position: 'absolute',
            left: `${localTime * 100 - 20}px`,
            top: '-12px',
            width: '40px',
            textAlign: 'center',
            fontSize: '10px',
            color: 'red',
          }}
        >
          {formatTime(localTime)}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
