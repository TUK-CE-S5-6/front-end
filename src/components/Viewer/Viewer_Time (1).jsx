import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import store from '../../store';

/* =========================================
   언어별 CPS 맵
   ========================================= */
const CPS_MAP = {
  ko: 6.32516,
  zh: 4.9734373,
  ja: 5.1246,
  en: 14.949008,
};

/* =========================================
   텍스트 분할 (문장부호 우선 → 길이 보강)
   maxCharsPerCue는 2줄 기준 총 글자 수 목표 (약 22~26 권장)
   ========================================= */
// 문장부호 1차 → (영문일 때) 쉼표/세미콜론/콜론/대시 2차 → 길이 보강
function splitSmart(text, maxCharsPerCue = 72, _lang = 'ko') {
  // 1) 여러 공백 하나로
  const normalized = text.replace(/\s+/g, ' ').trim();

  // 2) 종결부호·쉼표 뒤에 공백이 있는 경우만 분할
  //    lookbehind로 부호 + 공백 패턴 잡아서 split
  const sentenceParts = normalized
    .split(/(?<=[.?!…。，！？,])\s+/) // ← 쉼표 추가
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks = [];
  for (const sentence of sentenceParts) {
    if (sentence.length <= maxCharsPerCue) {
      chunks.push(sentence);
      continue;
    }

    // 3) 공백 기준 분할 → 초과 시 하드컷
    const words = sentence.split(/(\s+)/); // 공백 유지
    let buf = '';
    for (const w of words) {
      if ((buf + w).trim().length > maxCharsPerCue) {
        if (buf.trim()) chunks.push(buf.trim());
        buf = w.trim();

        // 단어 자체가 너무 긴 경우 하드컷
        while (buf.length > maxCharsPerCue) {
          chunks.push(buf.slice(0, maxCharsPerCue));
          buf = buf.slice(maxCharsPerCue);
        }
      } else {
        buf += w;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
  }

  return chunks;
}

/* =========================================
   캔버스 폭 기반 줄바꿈 (픽셀 기준)
   ========================================= */
function wrapText(ctx, text, maxWidth) {
  // 공백이 적은 CJK 대응: 스페이스가 거의 없어도 글자 단위로 안전하게 줄바꿈
  const tokens = text.includes(' ') ? text.split(' ') : text.split(''); // 공백이 없으면 글자 단위
  const lines = [];
  let line = '';

  for (let i = 0; i < tokens.length; i++) {
    const sep = text.includes(' ') ? ' ' : '';
    const testLine = line + tokens[i] + sep;
    const w = ctx.measureText(testLine).width;
    if (w > maxWidth && line !== '') {
      lines.push(line.trim());
      line = tokens[i] + sep;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

/* =========================================
   워터필 스케일링: 합계를 D로 맞추되 각 항목 min/max 제약
   ========================================= */
function waterfillScale(raw, D, mins, maxs) {
  let x = raw.map((v, i) => Math.min(Math.max(v, mins[i]), maxs[i]));
  let sum = x.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - D) < 1e-6) return x;

  const n = x.length;
  const fixed = new Array(n).fill(false);

  for (let iter = 0; iter < 8; iter++) {
    sum = x.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - D) < 1e-3) break;

    const freeIdx = x.map((v, i) => (!fixed[i] ? i : -1)).filter((i) => i >= 0);
    if (!freeIdx.length) break;

    const freeSum = freeIdx.reduce((acc, i) => acc + x[i], 0);
    const need = D - sum;

    let changed = false;
    for (const i of freeIdx) {
      const delta = (x[i] / freeSum) * need;
      const v = x[i] + delta;
      const clamped = Math.min(Math.max(v, mins[i]), maxs[i]);
      if (clamped !== v) fixed[i] = true; // 경계 고정
      if (Math.abs(clamped - x[i]) > 1e-6) changed = true;
      x[i] = clamped;
    }
    if (!changed) break;
  }

  // 미세 보정
  let acc = x.reduce((a, b) => a + b, 0);
  const diff = D - acc;
  if (x.length) x[x.length - 1] += diff;
  return x;
}

// 텍스트 분할 결과(chunks)를 가중치 비례로 D에 맞춰 배분
function allocateByProportion(
  seg,
  splitFn,
  {
    minDur = 2.7, // 3배 설정 유지
    maxDur = 16.5, // 3배 설정 유지
    weight = (t) => t.replace(/\s/g, '').length || 1, // 기본: 공백 제외 글자수
  } = {}
) {
  const { start, end, text } = seg;
  const D = Math.max(0, end - start);
  const chunks = splitFn(text);
  if (!chunks.length || D === 0) return [{ text, start, end }];

  // 1) 가중치
  const ws = chunks.map(weight);
  const W = ws.reduce((a, b) => a + b, 0) || 1;

  // 2) 1차 배분 + 개별 min/max
  let durs = ws.map((w) => Math.max(minDur, Math.min(maxDur, (w / W) * D)));

  // 3) 합을 정확히 D로 맞추도록 스케일
  const sum = durs.reduce((a, b) => a + b, 0);
  const scale = sum === 0 ? 1 : D / sum;
  durs = durs.map((d) => d * scale);

  // 4) 누적으로 start/end 산출 (마지막은 end에 스냅)
  const cues = [];
  let t = start;
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const dur = isLast ? end - t : durs[i];
    cues.push({ text: chunks[i], start: t, end: t + dur });
    t += dur;
  }
  // 부동소수 보정
  if (cues.length) {
    cues[0].start = start;
    cues[cues.length - 1].end = end;
  }
  return cues;
}

/* =========================================
   HTA: 하이브리드 시간 분배 (CPS → 제약 → 스케일)
   단어 타임스탬프/무음 스냅은 생략(필요 시 확장 가능)
   ========================================= */
function allocateHTA(seg, splitFn, options) {
  const D = Math.max(0.1, seg.end - seg.start);
  const chunks = splitFn(seg.text);
  if (chunks.length === 0)
    return [{ text: '', start: seg.start, end: seg.end }];

  const { targetCps, minDur, maxDur } = options;
  const lens = chunks.map((t) => t.replace(/\s/g, '').length || 1);
  const raw = lens.map((L) => Math.max(L / targetCps, minDur));
  const mins = chunks.map(() => minDur);
  const maxs = chunks.map(() => Math.min(maxDur, D));

  const durs = waterfillScale(raw, D, mins, maxs);

  const cues = [];
  let t = seg.start;
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const end = isLast ? seg.end : Math.min(seg.end, t + durs[i]);
    cues.push({ text: chunks[i], start: t, end });
    t = end;
  }

  // 경계 보정
  if (cues.length) {
    cues[0].start = seg.start;
    cues[cues.length - 1].end = seg.end;
  }
  return cues;
}

/* =========================================
   트랙 → 자막 큐 계산 (언어별 CPS 적용)
   ========================================= */
const HTA_DEFAULTS_BASE = {
  minDur: 2.7, // 0.9 × 3
  maxDur: 16.5, // 5.5 × 3
  maxCharsPerCue: 72, // 24 × 3
};

function getCuesForTrack(track, groupLang) {
  const start = track.startTime || 0;
  const dur = track.duration || 0;
  const end = start + dur;
  if (!track.translatedText) return [];

  // 언어별 CPS 선택 (없으면 ko)
  const lang = (track.lang || groupLang || 'ko').toLowerCase();
  const targetCps = CPS_MAP[lang] ?? CPS_MAP.ko;

  const seg = { start, end, text: track.translatedText };

  // 가중치 = (공백 제외 글자수) / CPS  → 발화 시간 추정치에 비례
  const weight = (t) => {
    const L = t.replace(/\s/g, '').length || 1;
    return L / targetCps;
  };

  return allocateByProportion(
    seg,
    (txt) => splitSmart(txt, HTA_DEFAULTS_BASE.maxCharsPerCue, lang),
    {
      minDur: HTA_DEFAULTS_BASE.minDur,
      maxDur: HTA_DEFAULTS_BASE.maxDur,
      weight,
    }
  );
}

/* =========================================
   캔버스 렌더링 보조: 자막 박스 + 텍스트
   ========================================= */
function drawCueBoxAndText(
  ctx,
  canvasWidth,
  canvasHeight,
  lines,
  fontSize = 28,
  lineHeight = 36
) {
  const x = canvasWidth / 2;

  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle'; // ← 핵심: baseline을 가운데로

  // 배경 박스 크기 측정
  const padding = 10;
  let maxLineWidth = 0;
  lines.forEach((line) => {
    const w = ctx.measureText(line).width;
    if (w > maxLineWidth) maxLineWidth = w;
  });

  const textBlockHeight = lineHeight * lines.length; // 텍스트 블록 높이
  const rectWidth = maxLineWidth + padding * 2;
  const rectHeight = textBlockHeight + padding * 2;

  // 박스는 하단에서 20px 위
  const rectX = x - rectWidth / 2;
  const rectY = canvasHeight - 20 - rectHeight;

  // 반투명 박스
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

  // 텍스트를 박스 중앙에 세로 정렬
  const rectCenterY = rectY + rectHeight / 2;
  const firstLineY = rectCenterY - textBlockHeight / 2 + lineHeight / 2;

  // 텍스트(외곽선 + 채움)
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'white';
  lines.forEach((line, i) => {
    const y = firstLineY + i * lineHeight;
    ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
  });
}

/* =========================================
   컴포넌트
   ========================================= */
const baseUrl = 'http://localhost:8000/';

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

  // 전체 타임라인 길이
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
    // 비디오 엘리먼트 준비
    videoTracks.forEach((group) => {
      group.tracks.forEach((track) => {
        const url = track.url?.startsWith('http')
          ? track.url
          : baseUrl + track.url;
        const existing = videoElementsRef.current[track.id];
        if (!existing || existing.src !== url) {
          const v = document.createElement('video');
          v.crossOrigin = 'anonymous';
          v.preload = 'auto';
          v.src = url;
          v.volume = (group.volume ?? 100) / 100;
          videoElementsRef.current[track.id] = v;
        }
      });
    });

    // 오디오 엘리먼트 준비
    audioTracks.forEach((group) => {
      group.tracks.forEach((track) => {
        const url = track.url?.startsWith('http')
          ? track.url
          : baseUrl + track.url;
        const existing = audioElementsRef.current[track.id];
        if (!existing || existing.src !== url) {
          const a = document.createElement('audio');
          a.preload = 'auto';
          a.src = url;
          a.volume = (group.volume ?? 100) / 100;
          audioElementsRef.current[track.id] = a;
        }
      });
    });

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [videoTracks, audioTracks]);

  /* -------------------------
     Seek 핸들러
     ------------------------- */
  const handleSeekDrag = (e) => {
    const newTime = parseFloat(e.target.value);
    setLocalSeekTime(newTime);
    setGlobalTime(newTime);
    drawCanvasOnce(newTime);
  };
  const handleSeekCommit = () => {
    store.dispatch({ type: 'SET_TIME', payload: localSeekTime });
    if (isPlaying) {
      handleStop();
      handlePlay();
    }
  };

  /* -------------------------
     단일 프레임 렌더
     ------------------------- */
  const drawCanvasOnce = (timeSec) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);

    // 비디오 레이어
    videoTracks.forEach((group) => {
      group.tracks.forEach((track) => {
        const v = videoElementsRef.current[track.id];
        if (v && v.readyState >= 2) {
          // 단순히 현재 프레임 그리기 (seek 시 비디오의 프레임 업데이트를 강제하려면 currentTime 조정 필요)
          ctx.drawImage(v, 0, 0, c.width, c.height);
        }
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
          const cues = getCuesForTrack(track, group.lang);
          const active = cues.find(
            (q) => timeSec >= q.start && timeSec <= q.end
          );
          if (active) {
            // 픽셀 폭 기준 줄바꿈 (캔버스 90% 폭)
            const lines = wrapText(ctx, active.text, c.width * 0.9);
            drawCueBoxAndText(ctx, c.width, c.height, lines);
          }
        }
      });
    });
  };

  /* -------------------------
     애니메이션 루프 렌더
     ------------------------- */
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
          v?.readyState >= 2
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
          const cues = getCuesForTrack(track, group.lang);
          const active = cues.find(
            (q) => currentTime >= q.start && currentTime <= q.end
          );
          if (active) {
            const lines = wrapText(ctx, active.text, c.width * 0.9);
            drawCueBoxAndText(ctx, c.width, c.height, lines);
          }
        }
      });
    });

    animationFrameRef.current = requestAnimationFrame(drawCanvas);
  };

  /* -------------------------
     재생 / 정지
     ------------------------- */
  const handlePlay = () => {
    if (isPlaying) return;

    store.dispatch({ type: 'SET_PLAYING', payload: 1 });

    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setIsPlaying(true);
    playStartRef.current = Date.now() - globalTime * 1000;

    // 각 미디어 스케줄링
    [...videoTracks, ...audioTracks].forEach((group) => {
      group.tracks.forEach((track) => {
        const elem =
          videoElementsRef.current[track.id] ||
          audioElementsRef.current[track.id];
        if (!elem) return;
        const start = track.startTime || 0;
        const dur = track.duration || 0;
        const offset = globalTime - start;

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

  const handleStop = () => {
    if (!isPlaying) return;
    store.dispatch({ type: 'SET_TIME', payload: globalTime });
    store.dispatch({ type: 'SET_PLAYING', payload: 0 });
    setIsPlaying(false);
    cancelAnimationFrame(animationFrameRef.current);
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    Object.values(videoElementsRef.current).forEach((v) => v.pause());
    Object.values(audioElementsRef.current).forEach((a) => a.pause());
  };

  /* -------------------------
     합성 및 다운로드
     ------------------------- */
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

  /* -------------------------
     Redux 시간 동기화(정지 시)
     ------------------------- */
  useEffect(() => {
    if (isPlaying) return;
    const interval = setInterval(() => {
      const state = store.getState();
      const currentReduxTime = state.time;
      setGlobalTime(currentReduxTime);
    }, 100);
    return () => clearInterval(interval);
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
      {/* 상단 버튼 */}
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
          height: 'calc(100% - 40px - 40px - 40px)',
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
            maxWidth: '800px',
            minWidth: '440px',
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

      {/* 재생/정지 버튼 */}
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

      {/* 재생바 */}
      <div
        style={{
          height: '40px',
          padding: '0 1rem',
          boxSizing: 'border-box',
          flexShrink: 0,
          backgroundColor: '#313338',
          marginBottom: '800px',
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
