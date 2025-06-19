import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AudioTrack from './AudioTrack';
import VideoTrack from './VideoTrack';

const formatTime = (seconds) => {
  const sec = Math.floor(seconds);
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const Track = () => {
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

  const markerLeft = localTime * 100; // 1초당 100px 기준
  const timelineWidth = timelineDuration * 100;
  const numTicks = Math.ceil(timelineDuration * 10) + 1;

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

  return (
    <div
      ref={containerRef}
      className="track-container"
      style={{
        position: 'relative',
        width: '3000px',
        height: '500px',
        overflow: 'auto',
        border: '1px solid #ccc',
        backgroundColor: 'white',
      }}
    >
      <button onClick={addAudioTrack}>Add Audio Track {nextAudioIndex}</button>
      <button onClick={addVideoTrack}>Add Video Track {nextVideoIndex}</button>

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

      {/* 🔴 빨간 선 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: markerLeft+200,
          width: '2px',
          height: '100%',
          background: 'red',
          zIndex: 9999,
          pointerEvents: 'none'
        }}
      />
    </div>
  );
};

export default Track;
