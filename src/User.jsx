

import React, { useState, useRef, useEffect } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';

import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { resetUserState } from './store';
import 'react-circular-progressbar/dist/styles.css';
import './components/Viewer/test.css';
import './User.css';
import Track from './components/Track/Track';
import Viewer from './components/Viewer/test';
const BASE_URL = 'http://175.116.3.178:8000';

const processedGroups = new Set(); // 전역 중복방지용 (선택적 관리)

/**
 * 비디오 썸네일 생성 함수
 */
async function generateVideoCompositeThumbnail(videoUrl, intervalSec = 1.8) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const frameW = 160;
      const frameH = 90;
      const count = Math.ceil(duration / intervalSec);
      const lastSec = duration - intervalSec * (count - 1);
      const lastWidth = frameW * (lastSec / intervalSec);

      const canvas = document.createElement('canvas');
      canvas.width = frameW * (count - 1) + lastWidth;
      canvas.height = frameH;
      const ctx = canvas.getContext('2d');

      let idx = 0;
      video.onseeked = () => {
        ctx.drawImage(
          video,
          0,
          0,
          video.videoWidth,
          video.videoHeight,
          idx * frameW,
          0,
          frameW,
          frameH
        );
        idx++;
        if (idx < count) {
          video.currentTime = Math.min(idx * intervalSec, duration);
        } else {
          resolve(canvas.toDataURL('image/png'));
        }
      };
      video.currentTime = 0;
    };

    video.onerror = (e) => reject(new Error('썸네일 생성 오류: ' + e.message));
  });
}

/**
 * 오디오 파형 생성 함수
 */
async function fetchWaveform(url) {
  const token = localStorage.getItem('authToken');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`오디오 파일 불러오기 실패: ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const audioBuf = await ctx.decodeAudioData(arrayBuffer);
  ctx.close();

  const width = Math.floor(audioBuf.duration * 100);
  const height = 100;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d');

  c.fillStyle = '#fff';
  c.fillRect(0, 0, width, height);
  c.fillStyle = '#007bff';
  const data = audioBuf.getChannelData(0);
  const step = Math.floor(data.length / width);

  for (let i = 0; i < width; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += Math.abs(data[i * step + j]);
    const bar = Math.min((sum / step) * height * 3, height);
    c.fillRect(i, (height - bar) / 2, 1, bar);
  }

  return canvas.toDataURL();
}

/**
 * 서버에서 받은 영상 편집 데이터를 Redux store에 추가
 * @param {Array} videos - 서버에서 받은 비디오 정보 목록
 * @param {Function} dispatch - Redux dispatch 함수
 */
export async function updateTracksFromProjectInfo(
  videos,
  dispatch,
  setRetryQueue,
  updateProgress,
  generateVideoCompositeThumbnail,
  fetchWaveform
) {
  for (const info of videos) {
    const vid = info.video.video_id;

    // 비디오 트랙 그룹 추가
    const videoGroupId = `video-${vid}`;
    if (!processedGroups.has(videoGroupId)) {
      dispatch({
        type: 'ADD_VIDEO_GROUP',
        payload: {
          id: videoGroupId,
          volume: 0,
          name: 'Video Track 1',
          tracks: [],
        },
      });
      processedGroups.add(videoGroupId);
    }

    const videoUrl = info.video.file_path.startsWith('http')
      ? info.video.file_path
      : `${BASE_URL}/${info.video.file_path.replace(/^\//, '')}`;
    const videoDuration = info.video.duration || 0;
    let thumbnail = '';
    try {
      thumbnail = await generateVideoCompositeThumbnail(videoUrl);
    } catch (e) {
      console.error('썸네일 생성 실패', e);
    }

    dispatch({
      type: 'ADD_VIDEO_TRACKS',
      payload: {
        trackGroupId: videoGroupId,
        newTracks: [
          {
            id: `video-track-${vid}`,
            startTime: 0,
            duration: videoDuration,
            url: videoUrl,
            thumbnail,
            delayPx: 0,
            width: Math.floor(videoDuration * 100),
          },
        ],
      },
    });

    // 배경음 추가
    if (info.background_music?.file_path) {
      const bgGroupId = `bg-${vid}`;
      if (!processedGroups.has(bgGroupId)) {
        dispatch({
          type: 'ADD_AUDIO_GROUP',
          payload: { id: bgGroupId, volume: 100, tracks: [] },
        });
        processedGroups.add(bgGroupId);
      }
      const duration = info.background_music.duration || videoDuration;
      const path = info.background_music.file_path
        .replace(/\\/g, '/')
        .replace(/^\//, '');
      const audioUrl = info.background_music.file_path.startsWith('http')
        ? info.background_music.file_path
        : `${BASE_URL}/${path}`;
      let bgImg = '';
      try {
        bgImg = await fetchWaveform(audioUrl);
      } catch (e) {
        console.error('파형 생성 실패, 큐에 추가:', audioUrl);
        // ✅ 실패한 URL을 재시도 큐에 넣는다
        setRetryQueue((prev) => [
          ...prev,
          {
            type: 'audio',
            url: audioUrl,
            groupId: bgGroupId,
            trackId: `bg-track-${vid}`,
            duration,
          },
        ]);
      }
      dispatch({
        type: 'ADD_AUDIO_TRACKS',
        payload: {
          trackGroupId: bgGroupId,
          newTracks: [
            {
              id: `bg-track-${vid}`,
              startTime: 0,
              duration,
              url: audioUrl,
              waveformImage: bgImg,
              delayPx: 0,
              width: Math.floor(duration * 100),
            },
          ],
        },
      });
    }

    // TTS 트랙
    const speakers = Array.from(
      new Set((info.tts_tracks || []).map((t) => t.speaker))
    );
    for (const sp of speakers) {
      const spGroupId = `tts-${vid}-${sp}`;
      if (!processedGroups.has(spGroupId)) {
        dispatch({
          type: 'ADD_AUDIO_GROUP',
          payload: { id: spGroupId, volume: 100, tracks: [] },
        });
        processedGroups.add(spGroupId);
      }

      const ttsTracks = await Promise.all(
        info.tts_tracks
          .filter((t) => t.speaker === sp)
          .map(async (t) => {
            const path = t.file_path.replace(/\\/g, '/').replace(/^\//, '');
            const url = t.file_path.startsWith('http')
              ? t.file_path
              : `${BASE_URL}/${path}`;
            let waveformImage = '';
            let trackData = {
              id: t.tts_id,
              startTime: t.start_time,
              duration: t.duration,
              url,
              delayPx: Math.floor(t.start_time * 100),
              width: Math.floor(t.duration * 100),
              originalText: t.original_text,
              translatedText: t.translated_text,
              voice: t.voice,
            };

            try {
              waveformImage = await fetchWaveform(url);
            } catch (e) {
              console.warn('TTS 파형 생성 실패, 재시도 큐에 추가:', url);
              setRetryQueue((prev) => [
                ...prev,
                {
                  type: 'tts',
                  url,
                  groupId: spGroupId,
                  trackData,
                },
              ]);
            }

            return {
              ...trackData,
              waveformImage,
            };
          })
      );

      dispatch({
        type: 'ADD_AUDIO_TRACKS',
        payload: {
          trackGroupId: spGroupId,
          newTracks: ttsTracks,
        },
      });
    }
  }
}

function User() {
  // FormData 상태를 App.js에서 관리
  const [progress, setProgress] = useState(0); // 0~100%
  const [totalCount, setTotalCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0); // ✅ 이 줄이 누락되어 있었습니다!

  const [retryQueue, setRetryQueue] = useState([]); // 파형 생성 실패한 파일 재시도 큐
  const [loading, setLoading] = useState(true); // ← 추가
  const [error, setError] = useState(null); // ← 에러도 같이 관리하면 좋음
  // URL 파라미터에서 projectId를 가져옵니다
  const { projectId } = useParams();
  // 상단 영역 및 하단 영역 크기 조절 관련 상태들 (splitter 관련 코드 포함)
  const [topLeftWidth, setTopLeftWidth] = useState(860);
  const [bottomHeight, setBottomHeight] = useState(200);
  const verticalSplitterWidth = 5;
  const horizontalSplitterHeight = 5;
  const topRowRef = useRef(null);
  const containerRef = useRef(null);
  const isDraggingVertical = useRef(false);
  const isDraggingHorizontal = useRef(false);
  const dispatch = useDispatch();

  const updateProgress = () => {
    setSuccessCount((prev) => {
      const next = prev + 1;
      const ratio = (next / totalCount) * 100;
      console.log(`progress: ${next}/${totalCount} → ${ratio}%`);
      setProgress(parseFloat(ratio.toFixed(2)));
      if (next === totalCount) setLoading(false);
      return next;
    });
  };


  useEffect(() => {
    if (!projectId) {
      setError('projectId가 없습니다.');
      setLoading(false);
      return;
    }
    dispatch(resetUserState());

    const fetchAndDispatch = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(
          `${BASE_URL}/projects/${projectId}/videos/edit_data`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!res.ok) {
          const err = await res.json();
          setError(err.detail || '데이터 요청 실패');
          return;
        }

        const { videos } = await res.json();

        // ✅ 여기서 총 파일 수 계산
        let count = 0;
        videos.forEach((video) => {
          count += 1; // 비디오 썸네일
          if (video.background_music?.file_path) count += 1;
          count += video.tts_tracks?.length || 0;
        });
        setTotalCount(count); // ✅ 총 이미지 개수 설정

        await updateTracksFromProjectInfo(
          videos,
          dispatch,
          setRetryQueue,
          updateProgress, // ✅ 반드시 네 번째 인자로 추가
          generateVideoCompositeThumbnail,
          fetchWaveform
        );
      } catch (e) {
        console.error(e);
        setError('네트워크 오류');
      } finally {
        setLoading(false);
      }
    };

    fetchAndDispatch();
  }, [projectId, dispatch]);

  useEffect(() => {
    const handleVerticalMouseMove = (e) => {
      if (!isDraggingVertical.current || !topRowRef.current) return;
      const topRowRect = topRowRef.current.getBoundingClientRect();
      let newWidth = e.clientX - topRowRect.left;
      if (newWidth < 100) newWidth = 100;
      if (newWidth > topRowRect.width - 100 - verticalSplitterWidth) {
        newWidth = topRowRect.width - 100 - verticalSplitterWidth;
      }
      setTopLeftWidth(newWidth);
    };

    const handleVerticalMouseUp = () => {
      isDraggingVertical.current = false;
    };

    window.addEventListener('mousemove', handleVerticalMouseMove);
    window.addEventListener('mouseup', handleVerticalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleVerticalMouseMove);
      window.removeEventListener('mouseup', handleVerticalMouseUp);
    };
  }, []);

  const handleVerticalSplitterMouseDown = () => {
    isDraggingVertical.current = true;
  };

  useEffect(() => {
    const handleHorizontalMouseMove = (e) => {
      if (!isDraggingHorizontal.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      let newBottomHeight = containerRect.bottom - e.clientY;
      if (newBottomHeight < 100) newBottomHeight = 100;
      if (
        newBottomHeight >
        containerRect.height - horizontalSplitterHeight - 100
      ) {
        newBottomHeight = containerRect.height - horizontalSplitterHeight - 100;
      }
      setBottomHeight(newBottomHeight);
    };

    const handleHorizontalMouseUp = () => {
      isDraggingHorizontal.current = false;
    };

    window.addEventListener('mousemove', handleHorizontalMouseMove);
    window.addEventListener('mouseup', handleHorizontalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleHorizontalMouseMove);
      window.removeEventListener('mouseup', handleHorizontalMouseUp);
    };
  }, []);

  const handleHorizontalSplitterMouseDown = () => {
    isDraggingHorizontal.current = true;
  };

  // 상단 영역 높이 계산 (하단 영역 높이 + splitter 고려)
  const topHeight = `calc(100vh - ${bottomHeight + horizontalSplitterHeight
    }px)`;
  useEffect(() => {
    if (retryQueue.length === 0) return;

    const retryFailedWaveforms = async () => {
      const queueCopy = [...retryQueue];
      setRetryQueue([]); // 큐 초기화

      for (const item of queueCopy) {
        try {
          const img = await fetchWaveform(item.url);
          if (item.type === 'audio') {
            dispatch({
              type: 'ADD_AUDIO_TRACKS',
              payload: {
                trackGroupId: item.groupId,
                newTracks: [
                  {
                    id: item.trackId,
                    startTime: 0,
                    duration: item.duration,
                    url: item.url,
                    waveformImage: img,
                    delayPx: 0,
                    width: Math.floor(item.duration * 100),
                  },
                ],
              },
            });
          } else if (item.type === 'tts') {
            dispatch({
              type: 'ADD_AUDIO_TRACKS',
              payload: {
                trackGroupId: item.groupId,
                newTracks: [
                  {
                    ...item.trackData,
                    waveformImage: img,
                  },
                ],
              },
            });
          }
        } catch (err) {
          console.warn('❌ 파형 재시도 실패 (보류):', item.url);
          // 실패한 항목은 큐에 다시 넣음 (원하면 제한 조건도 걸 수 있음)
          setRetryQueue((prev) => [...prev, item]);
        }
      }
    };

    retryFailedWaveforms();
  }, [retryQueue]);

  return (
    <div>
      <div className="relative">
        {/* ── 로딩 오버레이 ─────────────────────────────── */}
        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="spinner" />
          </div>
        )}

        {/* ── 전체 레이아웃 컨테이너 ───────────────────── */}
        <div className="h-screen overflow-hidden">
          <div
            ref={containerRef}
            className="grid h-full text-[#f2f3f5] bg-[#2b2d31]"
            /* 행 높이만 상태값으로 유지 */
            style={{ gridTemplateRows: `${topHeight} ${horizontalSplitterHeight}px ${bottomHeight}px` }}
          >
            {/* ── 상단(좌·우) 영역 ─────────────────────── */}
            <div ref={topRowRef} className="col-span-2 flex gap-2">
              {/* ┌──➊ 왼쪽 위: 사이드바 + Outlet ───────── */}
              <div
                className="flex h-full overflow-hidden bg-[#313338]"
                style={{ width: `${topLeftWidth}px` }}   /* ← 드래그로 조절 */
              >
                <nav className="flex flex-col gap-2 p-2 min-w-[140px] h-full border-r border-[#1f1f2d] bg-[#15151e] font-sans">
                  {[
                    { to: '/', label: 'Home', icon: <HomeIcon /> },
                    { to: 'files', label: 'File Manager', icon: <FileIcon /> },
                    { to: 'script', label: 'Script', icon: <ScriptIcon /> },
                    { to: 'tts2', label: 'Voice Gen', icon: <VoiceIcon /> },
                    { to: 'TTSModel', label: 'Voice-Model', icon: <ModelIcon /> },
                    { to: 'Audio', label: 'Sound FX', icon: <SoundIcon /> },
                  ].map(({ to, label, icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-white ${isActive ? 'bg-[#2c2c3f]' : ''
                        }`
                      }
                    >
                      {icon}
                      <span className="text-sm leading-[18px]">{label}</span>
                    </NavLink>
                  ))}
                </nav>


                {/* 중첩 라우트 */}
                <div className="flex-1 h-full overflow-auto hide-scrollbar">
                  <Outlet context={{ projectId }} />
                </div>
              </div>

              {/* 세로 스플리터 */}
              <div
                onMouseDown={handleVerticalSplitterMouseDown}
                className="bg-[#404249] cursor-col-resize"
                style={{ width: `${verticalSplitterWidth}px` }}
              />

              {/* └──➋ 오른쪽 위: 비디오 뷰어 ───────────── */}
              <div className="flex-grow overflow-auto bg-[#2b2d31]">
                <Viewer />
              </div>
            </div>

            {/* ── 가로 스플리터 ─────────────────────────── */}
            <div
              onMouseDown={handleHorizontalSplitterMouseDown}
              className="col-span-2 bg-[#404249] cursor-row-resize"
              style={{ height: `${horizontalSplitterHeight}px` }}
            />

            {/* ── ➌ 하단: 트랙 영역 ────────────────────── */}
            <div className="col-span-2 overflow-auto hide-scrollbar">
              <Track />
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}

/* icons.js */
export const HomeIcon = (props) => (
  <svg
    {...props}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 10l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="M9 21V15h6v6" />
  </svg>
);

export const FileIcon = (props) => (
  <svg {...props} width="24" height="24" viewBox="0 0 256 256" fill="currentColor">
    <path d="M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72Z M40,56H92.69l16,16H40ZM216,200H40V88H216Z" />
  </svg>
);

export const ScriptIcon = (props) => (
  <svg {...props} width="24" height="24" viewBox="0 0 256 256" fill="currentColor">
    <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34Z M160,51.31L188.69,80H160Z M200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z" />
  </svg>
);

export const VoiceIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" fill="currentColor">
    <path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V232a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z" />
  </svg>
);

export const ModelIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" fill="currentColor">
    <path d="M200,48H136V16a8,8,0,0,0-16,0V48H56A32,32,0,0,0,24,80V192a32,32,0,0,0,32,32H200a32,32,0,0,0,32-32V80A32,32,0,0,0,200,48Zm16,144a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V80A16,16,0,0,1,56,64H200a16,16,0,0,1,16,16Zm-52-56H92a28,28,0,0,0,0,56h72a28,28,0,0,0,0-56Zm-28,16v24H120V152ZM80,164a12,12,0,0,1,12-12h12v24H92A12,12,0,0,1,80,164Zm84,12H152V152h12a12,12,0,0,1,0,24ZM72,108a12,12,0,1,1,12,12A12,12,0,0,1,72,108Zm88,0a12,12,0,1,1,12,12A12,12,0,0,1,160,108Z" />
  </svg>
);

export const SoundIcon = (props) => (
  <svg {...props} width="24" height="24" viewBox="0 0 256 256" fill="currentColor">
    <path d="M155.51,24.81a8,8,0,0,0-8.42.88L77.25,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V32A8,8,0,0,0,155.51,24.81ZM32,96H72v64H32ZM144,207.64,88,164.09V91.91l56-43.55Zm54-106.08a40,40,0,0,1,0,52.88,8,8,0,0,1-12-10.58,24,24,0,0,0,0-31.72,8,8,0,0,1,12-10.58ZM248,128a79.9,79.9,0,0,1-20.37,53.34,8,8,0,0,1-11.92-10.67,64,64,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67A79.83,79.83,0,0,1,248,128Z" />
  </svg>
);


export default User;