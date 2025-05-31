import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';

const Viewer = () => {
  const videoTracks = useSelector(state => state.videoTracks);
  const audioTracks = useSelector(state => state.audioTracks);
  const canvasRef = useRef(null);
  const videoElementsRef = useRef({});
  const audioElementsRef = useRef({});
  const [videoTimeouts, setVideoTimeouts] = useState([]);
  const [audioTimeouts, setAudioTimeouts] = useState([]);
  const baseUrl = "http://175.116.3.178:8000/";
  const animationFrameRef = useRef(null);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const playingTracks = [];
    videoTracks.forEach(group => {
      group.tracks.forEach(track => {
        const videoElem = videoElementsRef.current[track.id];
        if (videoElem && videoElem.readyState >= 2 && !videoElem.paused) {
          const elapsed = videoElem.currentTime - (track.startTime || 0);
          if (elapsed >= 0 && elapsed < track.duration) {
            playingTracks.push({ track, videoElem });
          }
        }
      });
    });

    if (playingTracks.length > 0) {
      playingTracks.sort((a, b) => {
        const toNum = id =>
          parseInt((id + '').match(/\d+$/)?.[0] ?? '0', 10);
        return toNum(b.track.id) - toNum(a.track.id);
      });

      playingTracks.forEach(({ videoElem }) => {
        ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
      });
    }

    animationFrameRef.current = requestAnimationFrame(drawCanvas);
  };

  const handleVideoPlay = () => {
    const timeouts = [];
    videoTracks.forEach(group => {
      group.tracks.forEach(track => {
        const videoUrl = track.url.startsWith("http") ? track.url : baseUrl + track.url;
        const existing = videoElementsRef.current[track.id];

        if (!existing || existing.src !== videoUrl) {
          const videoElem = document.createElement('video');
          videoElem.src = videoUrl;
          videoElem.volume = group.volume / 100;
          videoElem.currentTime = track.startTime || 0;
          videoElementsRef.current[track.id] = videoElem;
        } else {
          existing.volume = group.volume / 100;
          existing.currentTime = track.startTime || 0;
        }

        const delaySec = track.startTime || 0;
        const timeoutId = setTimeout(() => {
          const videoElem = videoElementsRef.current[track.id];
          if (videoElem) videoElem.play();
        }, delaySec * 1000);
        timeouts.push(timeoutId);
      });
    });
    setVideoTimeouts(timeouts);
  };

  // ✅ 수정된 오디오 재생 예약 함수 (url 변경 감지 반영)
  const handleAudioPlay = async () => {
    const timeouts = [];
    for (const group of audioTracks) {
      for (const track of group.tracks) {
        let audioUrl = track.url.startsWith("http")
          ? track.url
          : baseUrl + track.url;

        const existing = audioElementsRef.current[track.id];

        if (!existing || existing.src !== audioUrl) {
          const audioElem = document.createElement('audio');
          audioElem.src = audioUrl;
          audioElem.volume = group.volume / 100;
          audioElem.currentTime = 0;

          const canPlay = audioElem.canPlayType("audio/mpeg");
          if (!canPlay && audioUrl.endsWith(".mp3")) {
            try {
              const response = await fetch(audioUrl);
              if (!response.ok) {
                throw new Error(`오디오 파일을 가져올 수 없습니다: ${audioUrl}`);
              }
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              audioElem.src = blobUrl;
            } catch (error) {
              console.error("오디오 파일 가져오기 에러:", error);
              continue;
            }
          }

          audioElementsRef.current[track.id] = audioElem;
        } else {
          existing.volume = group.volume / 100;
          existing.currentTime = 0;
        }

        const delaySec = track.startTime || 0;
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

  const handlePlay = () => {
    handleStop();
    handleVideoPlay();
    handleAudioPlay().catch(err => console.error("Audio play scheduling error:", err));
    drawCanvas();
  };

  const handleStop = () => {
    videoTimeouts.forEach(clearTimeout);
    setVideoTimeouts([]);
    audioTimeouts.forEach(clearTimeout);
    setAudioTimeouts([]);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
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

  useEffect(() => {
    handleStop();
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
