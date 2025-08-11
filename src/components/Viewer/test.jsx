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
   ========================================= */
function splitSmart(text, maxCharsPerCue = 72, _lang = 'ko') {
  const normalized = text.replace(/\s+/g, ' ').trim();

  const sentenceParts = normalized
    .split(/(?<=[.?!…。，！？,])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks = [];
  for (const sentence of sentenceParts) {
    if (sentence.length <= maxCharsPerCue) {
      chunks.push(sentence);
      continue;
    }
    const words = sentence.split(/(\s+)/);
    let buf = '';
    for (const w of words) {
      if ((buf + w).trim().length > maxCharsPerCue) {
        if (buf.trim()) chunks.push(buf.trim());
        buf = w.trim();
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
  const tokens = text.includes(' ') ? text.split(' ') : text.split('');
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
   워터필 스케일링
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
      if (clamped !== v) fixed[i] = true;
      if (Math.abs(clamped - x[i]) > 1e-6) changed = true;
      x[i] = clamped;
    }
    if (!changed) break;
  }

  let acc = x.reduce((a, b) => a + b, 0);
  const diff = D - acc;
  if (x.length) x[x.length - 1] += diff;
  return x;
}

/* =========================================
   비율 배분
   ========================================= */
function allocateByProportion(
  seg,
  splitFn,
  {
    minDur = 2.7,
    maxDur = 16.5,
    weight = (t) => t.replace(/\s/g, '').length || 1,
  } = {}
) {
  const { start, end, text } = seg;
  const D = Math.max(0, end - start);
  const chunks = splitFn(text);
  if (!chunks.length || D === 0) return [{ text, start, end }];

  const ws = chunks.map(weight);
  const W = ws.reduce((a, b) => a + b, 0) || 1;

  let durs = ws.map((w) => Math.max(minDur, Math.min(maxDur, (w / W) * D)));
  const sum = durs.reduce((a, b) => a + b, 0);
  const scale = sum === 0 ? 1 : D / sum;
  durs = durs.map((d) => d * scale);

  const cues = [];
  let t = start;
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const dur = isLast ? end - t : durs[i];
    cues.push({ text: chunks[i], start: t, end: t + dur });
    t += dur;
  }
  if (cues.length) {
    cues[0].start = start;
    cues[cues.length - 1].end = end;
  }
  return cues;
}

/* =========================================
   HTA
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

  if (cues.length) {
    cues[0].start = seg.start;
    cues[cues.length - 1].end = seg.end;
  }
  return cues;
}

/* =========================================
   트랙 → 자막 큐 계산
   ========================================= */
const HTA_DEFAULTS_BASE = {
  minDur: 2.7,
  maxDur: 16.5,
  maxCharsPerCue: 72,
};

function getCuesForTrack(track, groupLang) {
  const start = track.startTime || 0;
  const dur = track.duration || 0;
  const end = start + dur;
  if (!track.translatedText) return [];

  const lang = (track.lang || groupLang || 'ko').toLowerCase();
  const targetCps = CPS_MAP[lang] ?? CPS_MAP.ko;

  const seg = { start, end, text: track.translatedText };

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
   기본 박스 드로어 (기존)
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
  ctx.textBaseline = 'middle';

  const padding = 10;
  let maxLineWidth = 0;
  lines.forEach((line) => {
    const w = ctx.measureText(line).width;
    if (w > maxLineWidth) maxLineWidth = w;
  });

  const textBlockHeight = lineHeight * lines.length;
  const rectWidth = maxLineWidth + padding * 2;
  const rectHeight = textBlockHeight + padding * 2;

  const rectX = x - rectWidth / 2;
  const rectY = canvasHeight - 20 - rectHeight;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

  const rectCenterY = rectY + rectHeight / 2;
  const firstLineY = rectCenterY - textBlockHeight / 2 + lineHeight / 2;

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
   옵션 버전 박스 드로어 (색 보더/위치 지정)
   ========================================= */
function drawCueBoxAndTextEx(
  ctx,
  canvasWidth,
  canvasHeight,
  lines,
  fontSize = 28,
  lineHeight = 36,
  {
    rectCenterX = canvasWidth / 2,
    rectBottom = canvasHeight - 20,
    padding = 10,
    borderColor = null,
  } = {}
) {
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let maxLineWidth = 0;
  lines.forEach((line) => {
    const w = ctx.measureText(line).width;
    if (w > maxLineWidth) maxLineWidth = w;
  });

  const textBlockHeight = lineHeight * lines.length;
  const rectWidth = maxLineWidth + padding * 2;
  const rectHeight = textBlockHeight + padding * 2;
  const rectX = rectCenterX - rectWidth / 2;
  const rectY = rectBottom - rectHeight;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

  if (borderColor) {
    ctx.fillStyle = borderColor;
    ctx.fillRect(rectX, rectY, 4, rectHeight);
    ctx.fillRect(rectX + rectWidth - 4, rectY, 4, rectHeight);
  }

  const rectCenterY = rectY + rectHeight / 2;
  const firstLineY = rectCenterY - textBlockHeight / 2 + lineHeight / 2;

  ctx.lineWidth = 4;
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'white';
  lines.forEach((line, i) => {
    const y = firstLineY + i * lineHeight;
    ctx.strokeText(line, rectCenterX, y);
    ctx.fillText(line, rectCenterX, y);
  });

  return { rectX, rectY, rectWidth, rectHeight };
}

/* =========================================
   활성 큐 수집
   ========================================= */
function collectActiveCuesWithMeta(currentTime, audioTracks) {
  const items = [];
  audioTracks.forEach((group, gi) => {
    (group.tracks || []).forEach((track) => {
      if (!track.translatedText) return;
      const cues = getCuesForTrack(track, group.lang);
      const active = cues.find(
        (q) => currentTime >= q.start && currentTime <= q.end
      );
      if (active) {
        items.push({
          speakerId: track.speakerId || group.speakerId || track.id,
          color:
            group.color ||
            ['#4F46E5', '#16A34A', '#EA580C', '#9333EA', '#0EA5E9'][gi % 5],
          text: active.text,
          startedAt: active.start,
          endsAt: active.end,
        });
      }
    });
  });
  items.sort((a, b) => a.startedAt - b.startedAt); // 먼저 시작 ↑
  return items;
}

/* =========================================
   스티키 레이아웃 결정
   ========================================= */
function resolveStickyLayout(activeItems, laneRef) {
  const st = laneRef.current;
  const byId = (id) => activeItems.find((x) => x.speakerId === id) || null;

  let bottom = st.bottomId ? byId(st.bottomId) : null;
  let top = st.topId ? byId(st.topId) : null;

  if (!bottom && !top) {
    if (activeItems.length >= 2) {
      // 처음 겹침: 먼저 시작 = 아래, 다음 시작 = 위
      bottom = activeItems[0];
      top = activeItems[1];
      st.bottomId = bottom.speakerId;
      st.topId = top.speakerId;
    } else if (activeItems.length === 1) {
      // 단독: 스티키 배정 없음(아래 한 박스만)
      bottom = activeItems[0];
      st.bottomId = null;
      st.topId = null;
    }
  } else {
    if (bottom && !top) {
      // 아래만 살아있는데 새로운 화자가 들어오면 그 화자를 위로
      const other = activeItems.find((i) => i.speakerId !== bottom.speakerId);
      if (other) {
        top = other;
        st.topId = other.speakerId;
      }
    }
    if (!bottom && top) {
      // 위만 살아있을 때 새로운 화자가 들어오면 그 화자를 아래로
      const other = activeItems.find((i) => i.speakerId !== top.speakerId);
      if (other) {
        bottom = other;
        st.bottomId = other.speakerId;
      }
    }
  }

  if (!bottom && !top && activeItems.length === 0) {
    st.bottomId = null;
    st.topId = null;
    st.lastTopBottom = null;
  }

  const overflow = activeItems.filter(
    (i) =>
      (!bottom || i.speakerId !== bottom.speakerId) &&
      (!top || i.speakerId !== top.speakerId)
  );

  return { bottom, top, overflow };
}

/* =========================================
   스티키 수직 스택 렌더
   ========================================= */
function drawVerticalStackWithLayout(ctx, canvasW, canvasH, layout, laneRef) {
  const baseBottom = canvasH - 20;
  const gap = 8;
  const maxWidth = canvasW * 0.9;
  const fontSize = 28;
  const lineHeight = 36;

  const drawBadge = (text, color, targetBottom, width = maxWidth) => {
    const lines = wrapText(ctx, text, width);
    return drawCueBoxAndTextEx(
      ctx,
      canvasW,
      canvasH,
      lines,
      fontSize,
      lineHeight,
      {
        rectCenterX: canvasW / 2,
        rectBottom: targetBottom,
        borderColor: color,
      }
    );
  };

  const { bottom, top, overflow } = layout;
  const st = laneRef.current;

  if (!bottom && !top) return;

  if (bottom && top) {
    const bottomBox = drawBadge(bottom.text, bottom.color, baseBottom);
    const topTargetBottom = bottomBox.rectY - gap;
    drawBadge(top.text, top.color, topTargetBottom);
    st.lastTopBottom = topTargetBottom; // 위의 Y 위치 기억
  } else if (bottom && !top) {
    drawBadge(bottom.text, bottom.color, baseBottom);
  } else if (!bottom && top) {
    const fallbackTopBottom = Math.max(baseBottom - 120, 40);
    const targetBottom = st.lastTopBottom ?? fallbackTopBottom;
    drawBadge(top.text, top.color, targetBottom);
  }

  if (overflow.length > 0) {
    const text = overflow.map((o) => o.text).join('\n');
    drawBadge(text, '#9CA3AF', Math.floor(canvasH * 0.2), canvasW * 0.6);
  }
}
const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
};

/* =========================================
   컴포넌트
   ========================================= */
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
  // isVertical 헬퍼(선택)
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const isVertical = aspectRatio === '9:16';

  // 🔸 스티키 레이아웃 상태
  const laneRef = useRef({
    bottomId: null,
    topId: null,
    lastTopBottom: null,
  });

  const [globalTime, setGlobalTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [localSeekTime, setLocalSeekTime] = useState(globalTime);

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
  // [ADD] 컴포넌트 내부 최상단(다른 useState들 근처)
  // ✅ JS 버전

  // [ADD] 캔버스 내부 해상도와 컨테이너 비율 클래스
  const getCanvasSize = () => (
    aspectRatio === '16:9'
      ? { width: 1280, height: 720 }
      : { width: 1080, height: 1920 } // 쇼츠 표준
  );
  const { width: canvasW, height: canvasH } = getCanvasSize();

  const containerAspectClass =
    aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]';

  // [ADD] 비율 변경 시 한 프레임 다시 그려주기
  useEffect(() => {
    drawCanvasOnce(globalTime);
    // 스티키 레이아웃을 비율 변경 시 초기화하고 싶다면 아래 주석 해제
    // laneRef.current = { bottomId: null, topId: null, lastTopBottom: null };
  }, [aspectRatio]); // eslint-disable-line

  useEffect(() => {
    // 비디오 준비
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

    // 오디오 준비
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

    // 🔸 시킹 확정 시 스티키 초기화
    laneRef.current = { bottomId: null, topId: null, lastTopBottom: null };

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

    // 비디오
    videoTracks.forEach((group) => {
      group.tracks.forEach((track) => {
        const v = videoElementsRef.current[track.id];
        if (v && v.readyState >= 2) {
          ctx.drawImage(v, 0, 0, c.width, c.height);
        }
      });
    });

    // 자막 (스냅샷으로 미리보기: laneRef 원본 불변)
    const activeItemsOnce = collectActiveCuesWithMeta(timeSec, audioTracks);
    const laneSnapshot = { ...laneRef.current };
    const tempRef = { current: laneSnapshot };
    const layoutOnce = resolveStickyLayout(activeItemsOnce, tempRef);
    drawVerticalStackWithLayout(ctx, c.width, c.height, layoutOnce, tempRef);
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

    // 자막 (스티키 레이아웃)
    const activeItems = collectActiveCuesWithMeta(currentTime, audioTracks);
    const layout = resolveStickyLayout(activeItems, laneRef);
    drawVerticalStackWithLayout(ctx, c.width, c.height, layout, laneRef);

    animationFrameRef.current = requestAnimationFrame(drawCanvas);
  };

  /* -------------------------
     재생 / 정지
     ------------------------- */
  const handlePlay = () => {
    if (isPlaying) return;

    // 🔸 재생 시작 시 스티키 초기화
    laneRef.current = { bottomId: null, topId: null, lastTopBottom: null };

    store.dispatch({ type: 'SET_PLAYING', payload: 1 });

    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setIsPlaying(true);
    playStartRef.current = Date.now() - globalTime * 1000;

    // 미디어 스케줄링
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
    <div className="flex flex-col h-full box-border bg-[#15151e] text-white">
      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
        <div
          className={`relative border border-[#15151e] ${aspectRatio === '9:16'
            ? 'h-full w-auto'     // 세로(부모 높이)에 맞춰 가로가 비율로 계산됨
            : 'w-full h-auto'     // 가로(부모 너비)에 맞춰 세로가 비율로 계산됨
            } max-w-full max-h-full`}
          style={{ aspectRatio: aspectRatio === '9:16' ? '9 / 16' : '16 / 9' }}
        >
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </div>




      {/* 하단 컨트롤 바 (슬라이더 + 버튼들) */}
      <div>
        {/* 진행 슬라이더 */}
        <input
          type="range"
          min={0}
          max={totalDuration}
          step="0.01"
          value={globalTime}
          onChange={handleSeekDrag}
          onMouseUp={handleSeekCommit}
          onTouchEnd={handleSeekCommit}
          className="relative w-full accent-white mb-0.5"
        />

        {/* 컨트롤 버튼 행 */}
        <div className="flex items-center -mt-1.5 pr-1.5">
          {/* ▶ 재생 */}
          <button
            onClick={handlePlay}
            aria-label="재생"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#242447]/80 hover:bg-[#242447]/90 ml-0.5 -mt-0.5 mb-0.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 text-white"
              viewBox="0 0 256 256"
              fill="currentColor"
            >
              <path d="M240 128a15.74 15.74 0 01-7.6 13.51L88.32 229.65a16 16 0 01-16.2.3A15.86 15.86 0 0164 216.13V39.87a15.86 15.86 0 018.12-13.82 16 16 0 0116.2.3L232.4 114.49A15.74 15.74 0 01240 128z" />
            </svg>
          </button>

          {/* ⏹ 정지 */}
          <button
            onClick={handleStop}
            aria-label="정지"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#242447]/80 hover:bg-[#242447]/90 ml-2 -mt-0.5 mb-0.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 text-white"
              viewBox="0 0 256 256"
              fill="currentColor"
            >
              <path d="M200 56H56a16 16 0 00-16 16v112a16 16 0 0016 16h144a16 16 0 0016-16V72a16 16 0 00-16-16z" />
            </svg>
          </button>
          {/* [ADD] 비율 전환 버튼 그룹 */}
          <div className="ml-2 flex overflow-hidden rounded-md border border-[#2c2c35]">
            <button
              onClick={() => setAspectRatio('16:9')}
              className={`px-2 py-1 text-xs font-semibold ${aspectRatio === '16:9' ? 'bg-[#2c2c35] text-white' : 'bg-transparent text-[#c7c9d1]'
                }`}
              aria-pressed={aspectRatio === '16:9'}
              title="16:9로 보기"
            >
              16:9
            </button>
            <button
              onClick={() => setAspectRatio('9:16')}
              className={`px-2 py-1 text-xs font-semibold border-l border-[#2c2c35] ${aspectRatio === '9:16' ? 'bg-[#2c2c35] text-white' : 'bg-transparent text-[#c7c9d1]'
                }`}
              aria-pressed={aspectRatio === '9:16'}
              title="9:16(쇼츠)로 보기"
            >
              9:16
            </button>
          </div>

          {/* 시간 표시 */}
          {/* 시간 표시 */}
          <div className="ml-auto mr-3 text-xs text-[#f2f3f5]">
            {formatTime(globalTime)} / {formatTime(totalDuration)}
          </div>


          {/* 다운로드(합성) */}
          <button
            onClick={handleMergeClick}
            className="flex items-center gap-2 rounded-md bg-[#242447] px-3 py-1.5 text-sm font-medium hover:bg-[#1d1d38] transition-colors"
          >
            <i className="fi fi-br-download" style={{ fontSize: 16, lineHeight: 0 }} />
            다운로드
          </button>
        </div>
      </div>
    </div>
  );

};

export default MergeAndPreviewPage;
