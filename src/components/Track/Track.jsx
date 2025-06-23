import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AudioTrack from './AudioTrack';
import VideoTrack from './VideoTrack';
import './Track.css'; // 스타일 파일을 import
const formatTime = (seconds) => {
  const sec = Math.floor(seconds);
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
const useTotalTrackGroupCount = () => {
  const audioTracks = useSelector((state) => state.audioTracks);
  const videoTracks = useSelector((state) => state.videoTracks);
  return audioTracks.length + videoTracks.length;
};
const Track = () => {
  const trackOffset = 200; // 눈금 및 빨간선 시작 위치
  const dragRef = useRef(null);

  const [zoom, setZoom] = useState(100); // 🔍 확대/축소 비율 상태 (1초당 px 수)

  const dispatch = useDispatch();
  const audioTracks = useSelector((state) => state.audioTracks);
  const videoTracks = useSelector((state) => state.videoTracks);
  const nextAudioIndex = useSelector((state) => state.nextAudioTrackIndex);
  const nextVideoIndex = useSelector((state) => state.nextVideoTrackIndex);
  const reduxTime = useSelector((state) => state.time);
  const isPlaying = useSelector((state) => state.isPlaying);
  const timelineDuration = useSelector((state) => state.timelineDuration);

  const [localTime, setLocalTime] = useState(reduxTime);
  const startTimeRef = useRef(Date.now());
  const containerRef = useRef(null);
  const totalGroupCount = useTotalTrackGroupCount();
  const trackHeight = 100; // 한 그룹당 높이
  const totalHeight = totalGroupCount * trackHeight + 11; // + 여유 padding
  useEffect(() => {
    let raf;
    if (isPlaying) {
      startTimeRef.current = Date.now() - localTime * 1000;
      const updateTime = () => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setLocalTime(elapsed);
        if (containerRef.current) {
          containerRef.current.scrollLeft = elapsed * 100 - 300; // 100px per sec, with offset
        }
        raf = requestAnimationFrame(updateTime);
      };
      raf = requestAnimationFrame(updateTime);
    } else {
      setLocalTime(reduxTime);
    }
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, reduxTime]);

  const localTimeRef = useRef(localTime);  // 추가
  const lastDispatchTimeRef = useRef(0);
  const DISPATCH_INTERVAL = 200;

  const handleDragStart = (e) => {
    e.preventDefault();

    const containerRect = containerRef.current.getBoundingClientRect();
    const startMouseX = e.clientX - containerRect.left;
    const startLocalTime = localTime;

    // 1️⃣ 시작 즉시 dispatch
    dispatch({ type: 'SET_TIME', payload: startLocalTime });
    lastDispatchTimeRef.current = Date.now();

    const onMouseMove = (moveEvent) => {
      const currentMouseX = moveEvent.clientX - containerRect.left;
      const deltaX = currentMouseX - startMouseX;
      const newTime = startLocalTime + deltaX / 100;

      if (newTime >= 0) {
        setLocalTime(newTime);
        localTimeRef.current = newTime; // ⭐ 항상 최신값 추적

        const now = Date.now();
        if (now - lastDispatchTimeRef.current > DISPATCH_INTERVAL) {
          dispatch({ type: 'SET_TIME', payload: newTime });
          lastDispatchTimeRef.current = now;
        }
      }
    };

    const onMouseUp = () => {
      // 3️⃣ 끝날 때는 최신 값 사용
      dispatch({ type: 'SET_TIME', payload: localTimeRef.current });
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };


  const markerLeft = localTime * 100; // 1초당 100px 기준
  const timelineWidth = timelineDuration * 100;
  const numTicks = Math.ceil(timelineDuration * 10) + 1;
  // 🔼 확대 버튼 (+)
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 100)); // 최대 500%
  };

  // 🔽 축소 버튼 (-)
  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 0)); // 최소 10%
  };

  // 🎚 슬라이더 조절
  const handleSliderChange = (e) => {
    setZoom(Number(e.target.value));
  };
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

  const addAudioTrack = () => {
    const newGroup = {
      id: Date.now(),
      volume: 100,
      tracks: [],
    };
    dispatch({ type: 'ADD_AUDIO_GROUP', payload: newGroup });
  };

  const addVideoTrack = () => {
    const newGroup = {
      id: Date.now(),
      volume: 100,
      tracks: [],
    };
    dispatch({ type: 'ADD_VIDEO_GROUP', payload: newGroup });
  };

  // ... 생략된 import 및 상태

  return (
    <div
      ref={containerRef}
      className="track-container hide-scrollbar"  // ← ✅ 클래스 추가
      style={{
        position: 'relative',
        width: '3000px',
        height: '500px',
        overflow: 'auto',               // ✅ 스크롤은 작동하도록 유지
        backgroundColor: '#2b2d31',
        color: '#f2f3f5',
      }}
    >
      {/* 🎛 상단 컨트롤 바 */}
      <div
        style={{
          position: 'sticky',      // ✅ 상단에 고정
          top: 0,                  // ✅ 화면 최상단
          zIndex: 10,              // ✅ 겹침 우선순위 설정
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 20px',
          backgroundColor: '#313338',
          borderBottom: '1px solid #404249',
        }}
      >
        <button style={{ background: '#5865f2', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px' }} onClick={addAudioTrack}>
          Add Audio Track {nextAudioIndex}
        </button>
        <button style={{ background: '#5865f2', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px' }} onClick={addVideoTrack}>
          Add Video Track {nextVideoIndex}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button style={{ background: '#404249', color: '#f2f3f5' }} onClick={handleZoomIn}>＋</button>
          <button style={{ background: '#404249', color: '#f2f3f5' }} onClick={handleZoomOut}>－</button>
          <input
            type="range"
            min="0"
            max="100"
            value={zoom}
            onChange={handleSliderChange}
            style={{ width: '150px', background: '#5865f2' }}
          />
          <span>{zoom}%</span>
        </div>
      </div>

      {/* Timeline 눈금 */}
      <div
        style={{
          position: 'relative',
          height: '40px',
          width: timelineWidth,
          marginLeft: '200px'
        }}
      >
        {ticks}
      </div>

      <VideoTrack />
      <AudioTrack />

      {/* 🔴 재생 바 */}
      <div
        style={{
          position: 'absolute',
          top: '97px',
          left: markerLeft + trackOffset,
          width: '2px',
          height: `${totalHeight}px`, // 동적으로 조절됨
          background: 'red',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      />

      {/* 🔴 재생 바 위 원 */}
      <div
        ref={dragRef}
        onMouseDown={handleDragStart}
        style={{
          position: 'absolute',
          top: '80px',
          left: markerLeft + trackOffset - 8,
          width: '17px',
          height: '17px',
          borderRadius: '50%',
          background: 'red',
          zIndex: 10000,
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      />
    </div>
  );

};

export default Track;