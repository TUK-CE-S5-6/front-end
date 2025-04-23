import React from 'react';
import { useSelector } from 'react-redux';

// 초 단위 숫자를 "HH:MM:SS" 형식의 문자열로 변환하는 함수
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
  // Redux에서 timelineDuration (초 단위)을 가져옵니다.
  const timelineDuration = useSelector(state => state.timelineDuration);
  // 전체 타임라인 너비: 1초당 100px
  const timelineWidth = timelineDuration * 100;
  // 0.1초마다 눈금을 그리므로, 총 눈금 개수 = (timelineDuration * 10) + 1
  const numTicks = Math.ceil(timelineDuration * 10) + 1;

  const ticks = [];
  for (let i = 0; i < numTicks; i++) {
    const leftPos = i * 10; // 0.1초마다 10px 이동
    if (i % 10 === 0) {
      // 1초마다 긴 눈금: 눈금은 하단에 배치, 레이블은 눈금 위쪽에 위치
      ticks.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: leftPos,
            bottom: 0,
            width: '1px',
            height: '10px',
            background: '#333'
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '-20px',
              width: '40px',
              textAlign: 'center',
              fontSize: '10px'
            }}
          >
            {formatTime(i / 10)}
          </div>
        </div>
      );
    } else {
      // 0.1초 눈금 : 짧은 눈금 표시 (하단에 배치)
      ticks.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: leftPos,
            bottom: 0,
            width: '1px',
            height: '5px',
            background: '#666'
          }}
        />
      );
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        width: timelineWidth,
        height: '40px',
        border: '1px solid #ccc',
        marginLeft: '200px'  // 오른쪽으로 220px에서 10px 줄여 210px로 이동
      }}
    >
      {ticks}
    </div>
  );
};

export default Timeline;
