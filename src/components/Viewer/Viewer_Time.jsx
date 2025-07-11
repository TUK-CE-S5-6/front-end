import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import store from '../../store';

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';

    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth > maxWidth && line !== '') {
            lines.push(line.trim());
            line = words[i] + ' ';
        } else {
            line = testLine;
        }
    }
    if (line) lines.push(line.trim());
    return lines;
}
function wrapTextByCharCount(text, maxCharsPerLine = 100) {
    const lines = [];
    let i = 0;

    while (i < text.length) {
        lines.push(text.slice(i, i + maxCharsPerLine));
        i += maxCharsPerLine;
    }

    return lines;
}

function splitSubtitleByLineCount(ctx, text, startTime, duration, maxWidth, maxLines = 2) {
    const allLines = wrapText(ctx, text, maxWidth);

    if (allLines.length <= maxLines) {
        return [{ start: startTime, end: startTime + duration, lines: allLines }];
    }

    const totalChars = allLines.join('').length;
    const parts = [];
    let currentStart = startTime;

    for (let i = 0; i < allLines.length; i += maxLines) {
        const linesGroup = allLines.slice(i, i + maxLines);
        const groupChars = linesGroup.join('').length;
        const groupDuration = duration * (groupChars / totalChars);
        parts.push({
            start: currentStart,
            end: currentStart + groupDuration,
            lines: linesGroup
        });
        currentStart += groupDuration;
    }

    return parts;
}

// 자막 분할 유틸 (기존 코드 그대로 복원)
function splitSubtitleBySentenceWeight(text, startTime, duration) {
        const sentences = text.split(/(?<=[.?!])\s+/);
        const perSentence = duration / sentences.length;
        return sentences.map((s, i) => {
            // wrapTextByLangBreak: 영문 80/70자, CJK(한글·일본·중국어) 40/35자 기준
            const lines = wrapTextByLangBreak(s, 80, 70);
            return {
                start: startTime + perSentence * i,
                end:   startTime + perSentence * (i + 1),
                lines,
           };
        });
    }

function wrapTextByLangBreak(text, fullLimit = 90, fullSoft = 80) {
    const lines = [];
    let remaining = text.trim();
  
    // CJK(중국어·일본어) + 한글 유니코드 범위
    const CJK_HANGUL_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF]/;
    const isCJK = (str) => CJK_HANGUL_REGEX.test(str);
  
    while (remaining.length > 0) {
      // 남은 길이가 풀 리밋 이하면 그대로
      // 하지만 CJK 텍스트라면 절반 리밋 기준
      const useCJK = isCJK(remaining);
      const maxChars    = useCJK ? Math.floor(fullLimit  / 2) : fullLimit;
      const softLimit   = useCJK ? Math.floor(fullSoft   / 2) : fullSoft;
      const slice       = remaining.slice(0, maxChars);
  
      // softLimit 이후 첫 공백/구두점 찾기
      const nextBreakChars = /[ \u3000-\u303F\.\,，、。…\?\!！；：]/;
      let breakPos = -1;
      for (let i = softLimit; i < slice.length; i++) {
        if (nextBreakChars.test(slice[i])) {
          breakPos = i + 1;
          break;
        }
      }
      if (breakPos < 0) breakPos = maxChars;
  
      // 한 줄 잘라내기
      lines.push(slice.slice(0, breakPos).trim());
      remaining = remaining.slice(breakPos).trim();
    }
  
    return lines;
  }

const baseUrl = 'http://175.116.3.178:8000/';

const MergeAndPreviewPage = () => {
    const videoTracks = useSelector((state) => state.videoTracks);
    const audioTracks = useSelector((state) => state.audioTracks);

    const canvasRef = useRef(null);
    const videoElementsRef = useRef({});
    const audioElementsRef = useRef({});
    const animationFrameRef = useRef(null);
    const playStartRef = useRef(0);
    const timeoutsRef = useRef([]);

    const [globalTime, setGlobalTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const [localSeekTime, setLocalSeekTime] = useState(globalTime);
    const isDraggingRef = useRef(false);
    // 전체 타임라인 길이 계산
    const totalDuration = useMemo(() => {
        let max = 0;
        [...videoTracks, ...audioTracks].forEach((group) => {
            group.tracks.forEach((track) => {
                const end = (track.startTime || 0) + (track.duration || 0);
                if (end > max) max = end;
            });
        });
        return max;
    }, [videoTracks, audioTracks]);

    useEffect(() => {
        // 비디오
        videoTracks.forEach((group) => {
            group.tracks.forEach((track) => {
                const url = track.url.startsWith('http') ? track.url : baseUrl + track.url;
                const existing = videoElementsRef.current[track.id];

                if (!existing || existing.src !== url) {
                    const v = document.createElement('video');
                    v.crossOrigin = 'anonymous';
                    v.preload = 'auto';
                    v.src = url;
                    v.volume = group.volume / 100;
                    videoElementsRef.current[track.id] = v;
                }
            });
        });

        // 오디오
        audioTracks.forEach((group) => {
            group.tracks.forEach((track) => {
                const url = track.url.startsWith('http') ? track.url : baseUrl + track.url;
                const existing = audioElementsRef.current[track.id];

                if (!existing || existing.src !== url) {
                    const a = document.createElement('audio');
                    a.preload = 'auto';
                    a.src = url;
                    a.volume = group.volume / 100;
                    audioElementsRef.current[track.id] = a;
                }
            });
        });

        return () => {
            timeoutsRef.current.forEach(clearTimeout);
            cancelAnimationFrame(animationFrameRef.current);
        };
    }, [videoTracks, audioTracks]);


    // 슬라이더 이동 (Seek)
    const handleSeek = (e) => {
        const newTime = parseFloat(e.target.value);
        setGlobalTime(newTime);
        // 중간 재생 중지 및 타임아웃 초기화
        timeoutsRef.current.forEach(clearTimeout);
        Object.values(videoElementsRef.current).forEach((v) => v.pause());
        Object.values(audioElementsRef.current).forEach((a) => a.pause());
        // 각 요소 currentTime 설정
        videoTracks.forEach((group) => {
            group.tracks.forEach((track) => {
                const v = videoElementsRef.current[track.id];
                if (v.readyState)
                    v.currentTime = Math.max(newTime - (track.startTime || 0), 0);
            });
        });
        audioTracks.forEach((group) => {
            group.tracks.forEach((track) => {
                const a = audioElementsRef.current[track.id];
                if (a.readyState)
                    a.currentTime = Math.max(newTime - (track.startTime || 0), 0);
            });
        });
        if (isPlaying) {
            handleStop();
            handlePlay();
        } else {
            drawCanvasOnce(newTime);
        }
    };
    const handleSeekDrag = (e) => {
        const newTime = parseFloat(e.target.value);
        setLocalSeekTime(newTime);
        setGlobalTime(newTime); // canvas 업데이트
        drawCanvasOnce(newTime); // 정지 상태일 때 미리보기
    };
    const handleSeekCommit = () => {
        store.dispatch({ type: 'SET_TIME', payload: localSeekTime });
        if (isPlaying) {
            handleStop();
            handlePlay();
        }
    };
    // 일시정지 상태 단일 프레임 그리기
    const drawCanvasOnce = (timeSec) => {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        // 비디오 레이어
        videoTracks.forEach((group) => {
            group.tracks.forEach((track) => {
                const v = videoElementsRef.current[track.id];
                if (v.readyState >= 2) ctx.drawImage(v, 0, 0, c.width, c.height);
            });
        });
        // 자막 레이어
        audioTracks.forEach((group) => {
            group.tracks.forEach((track) => {
                const start = track.startTime || 0;
                const dur = track.duration || 0;
                if (
                    track.translatedText &&
                    timeSec >= start &&
                    timeSec <= start + dur
                ) {
                    const parts = splitSubtitleByLineCount(
                        ctx,
                        track.translatedText,
                        start,
                        dur,
                        canvas.width * 0.9 // 90% 폭 기준
                    );
                    parts.forEach(({ start, end, lines }) => {
                        if (timeSec >= start && timeSec <= end) {
                            const x = canvas.width / 2;
                            const fontSize = 28;
                            const lineHeight = 36;
                            const baseY = canvas.height - lines.length * lineHeight - 20;


                            ctx.font = `${fontSize}px sans-serif`;        // [변경] 그대로
                            ctx.textAlign = 'center';                          // [변경] 그대로

                            // 배경 박스 계산                                             // [추가]
                            const padding = 10;                                // [추가]
                            let maxLineWidth = 0;                                 // [추가]
                            lines.forEach(line => {
                                const w = ctx.measureText(line).width;               // [추가]
                                if (w > maxLineWidth) maxLineWidth = w;              // [추가]
                            });
                            const rectWidth = maxLineWidth + padding * 2;          // [추가]
                            const rectHeight = lineHeight * lines.length + padding * 2; // [추가]
                            const rectX = x - rectWidth / 2;                  // [추가]
                            const rectY = baseY - padding;                     // [추가]

                            // 검정 반투명 박스 그리기                                  // [추가]
                            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';                    // [추가]
                            ctx.fillRect(rectX, rectY, rectWidth, rectHeight);      // [추가]

                            // 텍스트 스트로크/채우기                                   // [변경]
                            ctx.lineWidth = 4;
                            ctx.strokeStyle = 'black';
                            ctx.fillStyle = 'white';
                            lines.forEach((line, i) => {
                                const y = baseY + i * lineHeight;
                                ctx.strokeText(line, x, y);
                                ctx.fillText(line, x, y);
                            });

                            // ↑ 교체 끝 ↑
                        }
                    });


                }
            });
        });
    };

    // 애니메이션 루프 그리기
    const drawCanvas = () => {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        const now = Date.now();
        const currentTime = Math.min(
            (now - playStartRef.current) / 1000,
            totalDuration
        );
        setGlobalTime(currentTime);
        // 비디오
        videoTracks.forEach((group) => {
            group.tracks.forEach((track) => {
                const start = track.startTime || 0;
                const dur = track.duration || 0;
                const v = videoElementsRef.current[track.id];
                if (
                    currentTime >= start &&
                    currentTime <= start + dur &&
                    v.readyState >= 2
                ) {
                    ctx.drawImage(v, 0, 0, c.width, c.height);
                }
            });
        });
        // 자막
        audioTracks.forEach((group) => {
            group.tracks.forEach((track) => {
                const start = track.startTime || 0;
                const dur = track.duration || 0;
                if (
                    track.translatedText &&
                    currentTime >= start &&
                    currentTime <= start + dur
                ) {
                    const parts = splitSubtitleBySentenceWeight(
                        track.translatedText,
                        start,
                        dur
                    );
                    parts.forEach(({ start, end, lines }) => {
                        if (currentTime >= start && currentTime <= end) {
                            const x = c.width / 2;
                            const fontSize = 28;
                            const lineHeight = 36;
                            const baseY = c.height - lines.length * lineHeight - 20;
                            ctx.font = `${fontSize}px sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.lineWidth = 4;
                            ctx.strokeStyle = 'black';
                            ctx.fillStyle = 'white';
                            lines.forEach((line, i) => {
                                const y = baseY + i * lineHeight;
                                ctx.strokeText(line, x, y);
                                ctx.fillText(line, x, y);
                            });
                        }
                    });
                }
            });
        });
        animationFrameRef.current = requestAnimationFrame(drawCanvas);
    };

    // 재생
    const handlePlay = () => {
        if (isPlaying) return;

        store.dispatch({ type: 'SET_PLAYING', payload: 1 });             // ⬅️ 재생 중으로 표시

        timeoutsRef.current.forEach(clearTimeout);
        timeoutsRef.current = [];
        setIsPlaying(true);
        playStartRef.current = Date.now() - globalTime * 1000;
        [...videoTracks, ...audioTracks].forEach((group) => {
            group.tracks.forEach((track) => {
                const elem =
                    videoElementsRef.current[track.id] ||
                    audioElementsRef.current[track.id];
                const start = track.startTime || 0;
                const dur = track.duration || 0;
                const offset = globalTime - start;
                if (!elem) return;
                if (offset < 0) {
                    const t1 = setTimeout(() => {
                        elem.currentTime = 0;
                        elem.play();
                    }, (start - globalTime) * 1000);
                    const t2 = setTimeout(() => {
                        elem.pause();
                    }, (start - globalTime + dur) * 1000);
                    timeoutsRef.current.push(t1, t2);
                } else if (offset <= dur) {
                    elem.currentTime = offset;
                    elem.play();
                    const t = setTimeout(() => {
                        elem.pause();
                    }, (dur - offset) * 1000);
                    timeoutsRef.current.push(t);
                }
            });
        });
        animationFrameRef.current = requestAnimationFrame(drawCanvas);
    };

    // 정지
    const handleStop = () => {
        if (!isPlaying) return;
        store.dispatch({ type: 'SET_TIME', payload: globalTime });      // ⬅️ 현재 시각 저장
        store.dispatch({ type: 'SET_PLAYING', payload: 0 });             // ⬅️ 정지 상태 저장
        setIsPlaying(false);
        cancelAnimationFrame(animationFrameRef.current);
        timeoutsRef.current.forEach(clearTimeout);
        timeoutsRef.current = [];
        Object.values(videoElementsRef.current).forEach((v) => v.pause());
        Object.values(audioElementsRef.current).forEach((a) => a.pause());
    };

    // 합성 및 다운로드
    const handleMergeClick = async () => {
        try {
            const vtPayload = videoTracks.map((g) => ({
                name: g.name || '',
                tracks: g.tracks.map((t) => ({
                    url: t.url,
                    startTime: t.startTime,
                    duration: t.duration,
                })),
            }));
            const atPayload = audioTracks.map((g) => ({
                name: g.name || '',
                tracks: g.tracks.map((t) => ({
                    url: t.url,
                    startTime: t.startTime,
                    duration: t.duration,
                })),
            }));
            const res = await fetch(`${baseUrl}merge-media`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoTracks: vtPayload,
                    audioTracks: atPayload,
                }),
            });
            if (!res.ok) throw new Error('서버 요청 실패');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'merged.mp4';
            a.click();
        } catch (err) {
            console.error(err);
        }
    };
    useEffect(() => {
        if (isPlaying) return;

        const interval = setInterval(() => {
            const state = store.getState();
            const currentReduxTime = state.time;
            setGlobalTime(currentReduxTime);
        }, 100); // 100ms 간격

        return () => clearInterval(interval); // cleanup
    }, [isPlaying]);
    return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 상단 버튼 영역 */}
      <div
        style={{
          height: '40px',
          padding: '0 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexShrink: 0,
          backgroundColor: '#313338',
        }}
      >
        <button onClick={handleMergeClick}>💾 합성 및 다운로드</button>
      </div>

      {/* Canvas 영역 */}
      <div
        style={{
          flex: '0 1 auto',
          height: 'calc(100% - 40px - 40px - 40px)', // 상단버튼(40) + 버튼영역(40) + 바(40) 제외
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '800px',   // ← 두 번째 코드에서 가져온 maxWidth
            minWidth: '440px',   // ← 두 번째 코드에서 가져온 minWidth
            aspectRatio: '16 / 9',
            backgroundColor: 'black',
          }}
        >
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            style={{
              width: '100%',
              height: '100%',
              minWidth: '640px',
              minHeight: '360px',
              maxWidth: '1280px',
              maxHeight: '720px',
              display: 'block',
              border: '1px solid #ccc',
            }}
          />
        </div>
      </div>

      {/* 재생/정지 버튼 영역 */}
      <div
        style={{
          height: '40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          flexShrink: 0,
          backgroundColor: '#313338',
        }}
      >
        <button onClick={handlePlay}>▶️ 재생</button>
        <button onClick={handleStop}>⏹ 정지</button>
      </div>

      {/* 재생바 (맨 아래) */}
      <div
        style={{
          height: '40px',
          padding: '0 1rem',
          boxSizing: 'border-box',
          flexShrink: 0,
          backgroundColor: '#313338',
          marginBottom: '800px', // ← 두 번째 코드에서 가져온 marginBottom
        }}
      >
        <input
          type="range"
          min={0}
          max={totalDuration}
          step="0.01"
          value={globalTime}
          onChange={handleSeekDrag}
          onMouseUp={handleSeekCommit}
          onTouchEnd={handleSeekCommit}
          style={{ width: '100%' }}
        />
        <div
          style={{
            textAlign: 'right',
            fontSize: '0.75rem',
            marginTop: '4px',
            color: '#f2f3f5',
          }}
        >
          {globalTime.toFixed(2)}s / {totalDuration.toFixed(2)}s
        </div>
      </div>
    </div>
  );
};

export default MergeAndPreviewPage;

