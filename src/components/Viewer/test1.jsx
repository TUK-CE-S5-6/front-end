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
            end: startTime + perSentence * (i + 1),
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
        const maxChars = useCJK ? Math.floor(fullLimit / 2) : fullLimit;
        const softLimit = useCJK ? Math.floor(fullSoft / 2) : fullSoft;
        const slice = remaining.slice(0, maxChars);

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
  const togglePlay = () => setIsPlaying((prev) => !prev);

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
    <div className="relative flex min-h-screen flex-col bg-[#131320] overflow-x-hidden">
      {/* 상단 바 */}
      <header className="h-10 px-4 flex items-center justify-end shrink-0 bg-[#131320]">
        <button className="flex items-center gap-1 rounded-md bg-[#242447] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1d1d38] transition-colors">
          💾 합성 및 다운로드
        </button>
      </header>

      {/* 메인 컨텐츠 래퍼 */}
      <main className="flex h-full grow flex-col items-center py-5 px-6">
        <section className="flex flex-col max-w-[920px] w-full">
          {/* ▶︎ 썸네일 / 플레이 영역 */}
          <div className="p-4">
            <div
              className="relative flex items-center justify-center bg-[#5e5eed] bg-cover bg-center aspect-video rounded-lg p-4"
              style={{
                backgroundImage:
                  'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCZADMTkFuk7d7ejXf8htJeWg6WQ1EYi5sIb0wcd4_fI95veGeXjqZaTRbuRfpaQjpAGzDGBXFe2GnecJMM07VDCIn_VoHmBb8yGVyF2AIgQMe380kgg3R8Im02n4HS-uQXZC0fjKRmzRdliLPf02nftmAjr4nAIMGb5USnVXnqXjhjrZ2yyTl7e8s7Rv_I2e0LQrck3_CPeYxiYfjoLssXBGeEy3Bwu3FdpGDqoT3Z6NcyooB8gm6bQhFlsk05tz2qep88GH8-GB6K")',
              }}
            >
              {/* 재생 / 정지 토글 버튼 */}
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? '정지' : '재생'}
                className="flex items-center justify-center w-16 h-16 rounded-full bg-[#242447]/80 hover:bg-[#242447]/90 text-white transition-colors"
              >
                {isPlaying ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M200 56H56a16 16 0 00-16 16v112a16 16 0 0016 16h144a16 16 0 0016-16V72a16 16 0 00-16-16z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M240 128a15.74 15.74 0 01-7.6 13.51L88.32 229.65a16 16 0 01-16.2.3A15.86 15.86 0 0164 216.13V39.87a15.86 15.86 0 018.12-13.82 16 16 0 0116.2.3L232.4 114.49A15.74 15.74 0 01240 128z" />
                  </svg>
                )}
              </button>

              {/* 진행 바 (목업) */}
              <div className="absolute inset-x-0 bottom-0 px-4 py-3">
                <div className="flex h-4 items-center">
                  <div className="flex-1 h-1 bg-white rounded-full" />
                  <div className="relative">
                    <div className="absolute -left-2 -top-2 w-4 h-4 bg-white rounded-full" />
                  </div>
                  <div className="flex-1 h-1 bg-white/40 rounded-full" />
                </div>
                <div className="flex items-center justify-between text-white text-xs font-medium tracking-[0.015em]">
                  <span>0:37</span>
                  <span>2:23</span>
                </div>
              </div>
            </div>
          </div>

          {/* ⏪⏩ 컨트롤 버튼 */}
          <div className="flex justify-center">
            <div className="flex flex-wrap gap-3 max-w-[480px] w-full px-4 py-3 justify-center">
              <button className="flex min-w-[84px] h-10 items-center justify-center rounded-lg px-4 bg-[#242447] hover:bg-[#1d1d38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#242447]/60 text-white text-sm font-bold grow transition-colors">
                Rewind&nbsp;5s
              </button>
              <button className="flex min-w-[84px] h-10 items-center justify-center rounded-lg px-4 bg-[#242447] hover:bg-[#1d1d38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#242447]/60 text-white text-sm font-bold grow transition-colors">
                Forward&nbsp;5s
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 하단 컨트롤 바 */}
      <footer className="h-10 px-4 flex items-center justify-between shrink-0 bg-[#131320] text-xs text-[#f2f3f5]">
        <span>0:00 / 0:00</span>
      </footer>
    </div>
  );
};



export default MergeAndPreviewPage;
