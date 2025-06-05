import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

const baseUrl = "http://175.116.3.178:8000/";

const MergeAndPreviewPage = () => {
  const videoTracks = useSelector(state => state.videoTracks);
  const audioTracks = useSelector(state => state.audioTracks);

  const canvasRef = useRef(null);
  const videoElementsRef = useRef({});
  const audioElementsRef = useRef({});
  const animationFrameRef = useRef(null);
  const [videoTimeouts, setVideoTimeouts] = useState([]);
  const [audioTimeouts, setAudioTimeouts] = useState([]);

    const wrapText = (ctx, text, maxWidth) => {
    const words = text.split(' ');
    const lines = [];
    let line = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth && line !== '') {
        lines.push(line.trim());
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());
    return lines;
  };


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
          const elapsed = videoElem.currentTime;
          if (
            elapsed >= (track.startTime || 0) &&
            elapsed < (track.startTime || 0) + (track.duration || 0)
          ) {
            playingTracks.push({ track, videoElem });
          }
        }
      });
    });

    if (playingTracks.length > 0) {
      // ID 기준으로 정렬
      playingTracks.sort((a, b) => {
        const toNum = id => parseInt((id + '').match(/\d+$/)?.[0] ?? '0', 10);
        return toNum(b.track.id) - toNum(a.track.id);
      });

      // 모든 비디오 트랙 그리기
      playingTracks.forEach(({ videoElem }) => {
        ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
      });

      // 자막은 가장 위에 그리기
      const currentTime = playingTracks[playingTracks.length - 1].videoElem.currentTime;

      // audioTracks에서 현재 시간에 맞는 translatedText 출력
      // 자막 출력
      audioTracks.forEach(group => {
        group.tracks.forEach(track => {
          const textStart = track.startTime || 0;
          const textEnd = textStart + (track.duration || 0);

          if (
            currentTime >= textStart &&
            currentTime <= textEnd &&
            track.translatedText
          ) {
            // 텍스트 스타일 지정
            ctx.font = '28px sans-serif';
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 4;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 2;

            const maxTextWidth = canvas.width - 40;
            const lineHeight = 36;

            // 자막 줄바꿈 처리
            const lines = wrapText(ctx, track.translatedText, maxTextWidth);

            // 줄 수에 따라 자막 위치를 자동 위로 조정
            const totalHeight = lines.length * lineHeight;
            const x = canvas.width / 2;
            const minY = 50;
            const baseY = Math.max(canvas.height - totalHeight - 20, minY);

            lines.forEach((line, i) => {
              const y = baseY + i * lineHeight;
              ctx.strokeText(line, x, y);
              ctx.fillText(line, x, y);
            });
          }
        });
      });


    };


    // 다음 프레임 예약
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

        const timeoutId = setTimeout(() => {
          const videoElem = videoElementsRef.current[track.id];
          if (videoElem) videoElem.play();
        }, (track.startTime || 0) * 1000);
        timeouts.push(timeoutId);
      });
    });
    setVideoTimeouts(timeouts);
  };

  const handleAudioPlay = async () => {
    const timeouts = [];
    for (const group of audioTracks) {
      for (const track of group.tracks) {
        const audioUrl = track.url.startsWith("http") ? track.url : baseUrl + track.url;
        const existing = audioElementsRef.current[track.id];

        if (!existing || existing.src !== audioUrl) {
          const audioElem = document.createElement('audio');
          audioElem.src = audioUrl;
          audioElem.volume = group.volume / 100;
          audioElem.currentTime = 0;

          if (!audioElem.canPlayType("audio/mpeg") && audioUrl.endsWith(".mp3")) {
            try {
              const response = await fetch(audioUrl);
              if (!response.ok) throw new Error("오디오 불러오기 실패");
              const blob = await response.blob();
              audioElem.src = URL.createObjectURL(blob);
            } catch (error) {
              console.error("오디오 에러:", error);
              continue;
            }
          }
          audioElementsRef.current[track.id] = audioElem;
        } else {
          existing.volume = group.volume / 100;
          existing.currentTime = 0;
        }

        const timeoutId = setTimeout(() => {
          const audioElem = audioElementsRef.current[track.id];
          if (audioElem) audioElem.play().catch(err => console.error("Audio play error:", err));
        }, (track.startTime || 0) * 1000);
        timeouts.push(timeoutId);
      }
    }
    setAudioTimeouts(timeouts);
  };

  const handlePlay = () => {
    handleStop();
    handleVideoPlay();
    handleAudioPlay().catch(console.error);
    drawCanvas();
  };

  const handleStop = () => {
    videoTimeouts.forEach(clearTimeout);
    audioTimeouts.forEach(clearTimeout);
    setVideoTimeouts([]);
    setAudioTimeouts([]);

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    Object.values(videoElementsRef.current).forEach(v => {
      v.pause(); v.currentTime = 0;
    });
    Object.values(audioElementsRef.current).forEach(a => {
      a.pause(); a.currentTime = 0;
    });

    const ctx = canvasRef.current?.getContext('2d');
    ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  useEffect(() => {
    handleStop();
  }, [videoTracks, audioTracks]);

  // 📥 서버로 merge 요청
  const handleMergeClick = async () => {
    try {
      const videoTracksPayload = videoTracks.map(group => ({
        name: group.name || '',
        volume: group.volume ?? 100,
        tracks: group.tracks.map(track => ({
          url: track.url.replace(/\\/g, '/'),
          startTime: track.startTime || 0
        }))
      }));

      const audioTracksPayload = audioTracks.map(group => ({
        volume: group.volume ?? 100,
        tracks: group.tracks.map(track => ({
          url: track.url,
          startTime: track.startTime || 0
        }))
      }));

      const payload = {
        videoTracks: videoTracksPayload,
        audioTracks: audioTracksPayload
      };

      const res = await fetch(`${baseUrl}merge-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('서버 요청 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.mp4';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('합성 실패:', err);
      alert('비디오 합성 중 오류 발생');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: 10 }}>
        <button onClick={handlePlay}>▶️ 재생</button>
        <button onClick={handleStop}>⏹ 정지</button>
        <button onClick={handleMergeClick}>💾 합성 및 다운로드</button>
      </div>
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{ border: '1px solid #ccc' }}
      />
    </div>
  );
};

export default MergeAndPreviewPage;
