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
  const baseUrl = "http://ec2-3-107-168-194.ap-southeast-2.compute.amazonaws.com:8000/";

  // 기존 videoTracks 관련 캔버스 드로잉 (변경 없음)
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    // 각 그룹의 트랙 중 재생 중인(readyState>=2, 아직 재생이 끝나지 않은) 비디오들을 모읍니다.
    const playingTracks = [];
    videoTracks.forEach(group => {
      group.tracks.forEach(track => {
        const videoElem = videoElementsRef.current[track.id];
        if (videoElem && videoElem.readyState >= 2 && videoElem.currentTime < videoElem.duration) {
          playingTracks.push({ group, track, videoElem });
        }
      });
    });
  
    if (playingTracks.length > 0) {
      // 우선순위 정렬:
      // 1. 다른 그룹이라면 group.id가 낮은(먼저 생성된) 그룹이 우선.
      // 2. 같은 그룹 내에서는 track.startTime이 낮은(먼저 시작한) 트랙이 우선.
      playingTracks.sort((a, b) => {
        if (a.group.id !== b.group.id) {
          return a.group.id - b.group.id;
        }
        return a.track.startTime - b.track.startTime;
      });
      const topTrack = playingTracks[0];
      ctx.drawImage(topTrack.videoElem, 0, 0, canvas.width, canvas.height);
    }
  
    const frameId = requestAnimationFrame(drawCanvas);
    setAnimationFrameId(frameId);
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

