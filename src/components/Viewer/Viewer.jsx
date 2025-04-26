import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';

const Viewer = () => {
  const videoTracks = useSelector(state => state.videoTracks);
  const audioTracks = useSelector(state => state.audioTracks);
  const canvasRef = useRef(null);
  const videoElementsRef = useRef({}); // { [track.id]: HTMLVideoElement }
  const audioElementsRef = useRef({}); // { [track.id]: HTMLAudioElement }
  const [videoTimeouts, setVideoTimeouts] = useState([]);
  const [audioTimeouts, setAudioTimeouts] = useState([]);
  const [animationFrameId, setAnimationFrameId] = useState(null);
  const baseUrl = "http://175.116.3.178:8000/";

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    // 재생 중인(readyState>=2) 비디오 중에서
    // 현재 재생 위치가 [startTime, startTime+duration) 범위 안에 있는 것만 필터링
    const playingTracks = [];
    videoTracks.forEach(group => {
      group.tracks.forEach(track => {
        const videoElem = videoElementsRef.current[track.id];
        if (videoElem && videoElem.readyState >= 2) {
          const elapsed = videoElem.currentTime - (track.startTime || 0);
          if (elapsed >= 0 && elapsed < track.duration) {
            playingTracks.push({ group, track, videoElem });
          }
        }
      });
    });
  
    if (playingTracks.length > 0) {
      // 1) 시작시간 오름차순  
      // 2) 시작시간 같으면 track.id 오름차순
      playingTracks.sort((a, b) => {
        if (a.track.startTime !== b.track.startTime) {
          return a.track.startTime - b.track.startTime;
        }
        // track.id가 숫자형이 아닐 경우 parseInt 해주세요
        return a.track.id - b.track.id;
      });
  
      // 가장 우선순위가 높은 트랙만 그리기
      const { videoElem } = playingTracks[0];
      ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
    }
  
    setAnimationFrameId(requestAnimationFrame(drawCanvas));
  };
  
  

  // 비디오 재생 예약 함수 (변경 없음)
  const handleVideoPlay = () => {
    const timeouts = [];
    videoTracks.forEach(group => {
      group.tracks.forEach(track => {
        if (!videoElementsRef.current[track.id]) {
          const videoElem = document.createElement('video');
          videoElem.src = track.url.startsWith("blob:")
            ? track.url
            : (track.url.startsWith("http") ? track.url : baseUrl + track.url);
          videoElem.volume = group.volume / 100;
          videoElem.currentTime = track.startTime || 0;
          videoElementsRef.current[track.id] = videoElem;
        } else {
          const videoElem = videoElementsRef.current[track.id];
          videoElem.volume = group.volume / 100;
          videoElem.currentTime = track.startTime || 0;
        }
        // 여기서는 startTime을 지연 시간으로 사용 (예: 2초면 2초 후에 재생)
        const delaySec = track.startTime ? track.startTime : 0;
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
  };

  // 오디오 재생 예약 함수 (수정됨)
  const handleAudioPlay = async () => {
    const timeouts = [];
    // audioTracks의 각 그룹을 순회
    for (const group of audioTracks) {
      for (const track of group.tracks) {
        if (!audioElementsRef.current[track.id]) {
          const audioElem = document.createElement('audio');
          // URL이 blob 형식이면 그대로 사용, 아니면 절대 URL로 처리
          let audioUrl = "";
          if (track.url.startsWith("blob:")) {
            audioUrl = track.url;
          } else {
            audioUrl = track.url.startsWith("http") ? track.url : baseUrl + track.url;
          }
          console.log("Audio file URL:", audioUrl);
          audioElem.src = audioUrl;
          // 확인: 브라우저가 이 소스를 지원하는지 canPlayType으로 체크 (여기서는 mp3를 예시)
          const canPlay = audioElem.canPlayType("audio/mpeg");
          console.log("canPlayType('audio/mpeg'):", canPlay);
          // 만약 지원하지 않는다면, fetch로 파일을 가져와 Blob URL을 생성
          if (!canPlay && audioUrl.endsWith(".mp3")) {
            try {
              const response = await fetch(audioUrl);
              if (!response.ok) {
                throw new Error(`오디오 파일을 가져올 수 없습니다: ${audioUrl}`);
              }
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              audioElem.src = blobUrl;
              console.log("Converted to blob URL:", blobUrl);
            } catch (error) {
              console.error("오디오 파일 가져오기 에러:", error);
              continue;
            }
          }
          audioElem.volume = group.volume / 100;
          // 재생은 항상 처음부터 시작
          audioElem.currentTime = 0;
          audioElementsRef.current[track.id] = audioElem;
        } else {
          const audioElem = audioElementsRef.current[track.id];
          audioElem.volume = group.volume / 100;
          audioElem.currentTime = 0;
        }
        // 재생 예약: track.startTime을 지연 시간으로 사용 (예: 2초면 2초 후 재생 시작)
        const delaySec = track.startTime ? track.startTime : 0;
        const timeoutId = setTimeout(() => {
          const audioElem = audioElementsRef.current[track.id];
          if (audioElem) {
            audioElem.play().catch(err => console.error("Audio play error:", err));
          }
        }, delaySec * 1000);
        timeouts.push(timeoutId);
      }
    }
    setAudioTimeouts(timeouts);
  };

  // Play 버튼 클릭 시: 비디오와 오디오 모두 재생 예약 및 캔버스 루프 시작
  const handlePlay = () => {
    handleStop(); // 기존 타이머 및 재생 정리
    handleVideoPlay();
    // handleAudioPlay는 async 함수이므로 catch any 에러
    handleAudioPlay().catch(err => console.error("Audio play scheduling error:", err));
    drawCanvas();
  };

  // Stop 버튼 클릭 시: 모든 타이머, 애니메이션 루프, 미디어 재생 정리 및 초기화
  const handleStop = () => {
    videoTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    setVideoTimeouts([]);
    audioTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    setAudioTimeouts([]);
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
    Object.values(audioElementsRef.current).forEach(audioElem => {
      if (audioElem) {
        audioElem.pause();
        audioElem.currentTime = 0;
      }
    });
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // videoTracks 또는 audioTracks가 변경되면 최신 상태 반영
  useEffect(() => {
    handleStop();
    handlePlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoTracks, audioTracks]);

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

