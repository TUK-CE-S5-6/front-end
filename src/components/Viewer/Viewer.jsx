import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';

const Viewer = () => {
  const videoTracks = useSelector(state => state.videoTracks);
  const canvasRef = useRef(null);
  const videoElementsRef = useRef({}); // { [track.id]: HTMLVideoElement }
  const [videoTimeouts, setVideoTimeouts] = useState([]);
  const [animationFrameId, setAnimationFrameId] = useState(null);

  // 캔버스에 현재 재생 중인 비디오 트랙 중 조건에 맞는 단 하나의 프레임만 그립니다.
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 각 그룹의 트랙 중 현재 재생 중(readyState>=2, 아직 재생 끝나지 않은)의 비디오들을 모읍니다.
    const playingTracks = [];
    videoTracks.forEach(group => {
      group.tracks.forEach(track => {
        const videoElem = videoElementsRef.current[track.id];
        if (videoElem && videoElem.readyState >= 2 && videoElem.currentTime < videoElem.duration) {
          playingTracks.push({ track, groupVolume: group.volume, videoElem });
        }
      });
    });

    if (playingTracks.length > 0) {
      // 조건 2,3: 먼저 생성된(낮은 id) 트랙, 그리고 같은 트랙에서는 낮은 startTime을 가진 트랙이 우선하도록 정렬합니다.
      playingTracks.sort((a, b) => {
        if (a.track.id !== b.track.id) {
          return a.track.id - b.track.id;
        }
        return a.track.startTime - b.track.startTime;
      });
      // 가장 우선순위가 높은 트랙 하나만 캔버스에 그립니다.
      const topTrack = playingTracks[0];
      ctx.drawImage(topTrack.videoElem, 0, 0, canvas.width, canvas.height);
    }

    const frameId = requestAnimationFrame(drawCanvas);
    setAnimationFrameId(frameId);
  };

  // Play 버튼 클릭 시: 각 트랙별 비디오 엘리먼트를 생성 후 delay에 따라 재생 예약 및 캔버스 드로잉 루프 시작
  const handlePlay = () => {
    handleStop(); // 기존 타이머와 재생, 캔버스 루프 정리
    const timeouts = [];
    videoTracks.forEach(group => {
      group.tracks.forEach(track => {
        // 비디오 엘리먼트가 없으면 생성
        if (!videoElementsRef.current[track.id]) {
          const videoElem = document.createElement('video');
          videoElem.src = track.url;
          videoElem.volume = group.volume / 100;
          videoElem.currentTime = track.startTime || 0;
          videoElementsRef.current[track.id] = videoElem;
        } else {
          // 이미 생성된 경우 업데이트
          const videoElem = videoElementsRef.current[track.id];
          videoElem.volume = group.volume / 100;
          videoElem.currentTime = track.startTime || 0;
        }
        // delayPx에 따른 재생 지연 (1px 당 0.01초)
        const delaySec = track.delayPx ? track.delayPx * 0.01 : 0;
        const timeoutId = setTimeout(() => {
          const videoElem = videoElementsRef.current[track.id];
          if (videoElem) {
            videoElem.play();
          }
        }, delaySec * 1000);
        timeouts.push(timeoutId);
      });
    });
    setVideoTimeouts(timeouts);
    drawCanvas();
  };

  // Stop 버튼 클릭 시: 모든 타이머, 애니메이션 루프 정리 및 비디오 정지
  const handleStop = () => {
    videoTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    setVideoTimeouts([]);
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      setAnimationFrameId(null);
    }
    Object.values(videoElementsRef.current).forEach(videoElem => {
      if (videoElem) {
        videoElem.pause();
        videoElem.currentTime = 0;
      }
    });
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // videoTracks가 변경되면 최신 상태를 반영하기 위해 재생을 갱신합니다.
  useEffect(() => {
    handleStop();
    handlePlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoTracks]);

  return (
    <div>
      <button onClick={handlePlay}>Play</button>
      <button onClick={handleStop}>Stop</button>
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{ border: '1px solid #ccc', marginTop: '10px' }}
      />
    </div>
  );
};

export default Viewer;
