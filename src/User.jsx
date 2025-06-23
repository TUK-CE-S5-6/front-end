import React, { useState, useRef, useEffect } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';

import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import 'react-circular-progressbar/dist/styles.css';

import './User.css';
import './App.css';
import './Layout.css';
import Track from './components/Track/Track';
import Viewer from './components/Viewer/Viewer_Time';
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
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, idx * frameW, 0, frameW, frameH);
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
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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

  c.fillStyle = '#fff'; c.fillRect(0, 0, width, height);
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
export async function updateTracksFromProjectInfo(videos, dispatch, setRetryQueue, updateProgress, generateVideoCompositeThumbnail, fetchWaveform) {
  for (const info of videos) {
    const vid = info.video.video_id;

    // 비디오 트랙 그룹 추가
    const videoGroupId = `video-${vid}`;
    if (!processedGroups.has(videoGroupId)) {
      dispatch({ type: 'ADD_VIDEO_GROUP', payload: { id: videoGroupId, volume: 0, name: 'Video Track 1', tracks: [] } });
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
        newTracks: [{
          id: `video-track-${vid}`,
          startTime: 0,
          duration: videoDuration,
          url: videoUrl,
          thumbnail,
          delayPx: 0,
          width: Math.floor(videoDuration * 100),
        }]
      }
    });

    // 배경음 추가
    if (info.background_music?.file_path) {
      const bgGroupId = `bg-${vid}`;
      if (!processedGroups.has(bgGroupId)) {
        dispatch({ type: 'ADD_AUDIO_GROUP', payload: { id: bgGroupId, volume: 100, tracks: [] } });
        processedGroups.add(bgGroupId);
      }
      const duration = info.background_music.duration || videoDuration;
      const path = info.background_music.file_path.replace(/\\/g, '/').replace(/^\//, '');
      const audioUrl = info.background_music.file_path.startsWith('http')
        ? info.background_music.file_path
        : `${BASE_URL}/${path}`;
      let bgImg = '';
      try { bgImg = await fetchWaveform(audioUrl); } catch (e) {
        console.error('파형 생성 실패, 큐에 추가:', audioUrl);
        // ✅ 실패한 URL을 재시도 큐에 넣는다
        setRetryQueue(prev => [...prev, { type: 'audio', url: audioUrl, groupId: bgGroupId, trackId: `bg-track-${vid}`, duration }]);
      }
      dispatch({
        type: 'ADD_AUDIO_TRACKS',
        payload: {
          trackGroupId: bgGroupId,
          newTracks: [{
            id: `bg-track-${vid}`,
            startTime: 0,
            duration,
            url: audioUrl,
            waveformImage: bgImg,
            delayPx: 0,
            width: Math.floor(duration * 100),
          }]
        }
      });
    }

    // TTS 트랙
    const speakers = Array.from(new Set((info.tts_tracks || []).map(t => t.speaker)));
    for (const sp of speakers) {
      const spGroupId = `tts-${vid}-${sp}`;
      if (!processedGroups.has(spGroupId)) {
        dispatch({ type: 'ADD_AUDIO_GROUP', payload: { id: spGroupId, volume: 100, tracks: [] } });
        processedGroups.add(spGroupId);
      }

      const ttsTracks = await Promise.all(
        info.tts_tracks
          .filter(t => t.speaker === sp)
          .map(async t => {
            const path = t.file_path.replace(/\\/g, '/').replace(/^\//, '');
            const url = t.file_path.startsWith('http') ? t.file_path : `${BASE_URL}/${path}`;
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
              voice: t.voice
            };

            try {
              waveformImage = await fetchWaveform(url);
            } catch (e) {
              console.warn('TTS 파형 생성 실패, 재시도 큐에 추가:', url);
              setRetryQueue(prev => [...prev, {
                type: 'tts',
                url,
                groupId: spGroupId,
                trackData
              }]);
            }

            return {
              ...trackData,
              waveformImage
            };
          })
      );


      dispatch({
        type: 'ADD_AUDIO_TRACKS',
        payload: {
          trackGroupId: spGroupId,
          newTracks: ttsTracks
        }
      });
    }
  }
}


function User() {
  // FormData 상태를 App.js에서 관리
  const [progress, setProgress] = useState(0); // 0~100%
  const [totalCount, setTotalCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);  // ✅ 이 줄이 누락되어 있었습니다!


  const [retryQueue, setRetryQueue] = useState([]); // 파형 생성 실패한 파일 재시도 큐
  const [loading, setLoading] = useState(true); // ← 추가
  const [error, setError] = useState(null);     // ← 에러도 같이 관리하면 좋음
  // URL 파라미터에서 projectId를 가져옵니다
  const { projectId } = useParams();
  // 상단 영역 및 하단 영역 크기 조절 관련 상태들 (splitter 관련 코드 포함)
  const [topLeftWidth, setTopLeftWidth] = useState(800);
  const [bottomHeight, setBottomHeight] = useState(320);
  const verticalSplitterWidth = 5;
  const horizontalSplitterHeight = 5;
  const topRowRef = useRef(null);
  const containerRef = useRef(null);
  const isDraggingVertical = useRef(false);
  const isDraggingHorizontal = useRef(false);
  const dispatch = useDispatch();

  const updateProgress = () => {
    setSuccessCount(prev => {
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

    const fetchAndDispatch = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(`${BASE_URL}/projects/${projectId}/videos/edit_data`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          const err = await res.json();
          setError(err.detail || '데이터 요청 실패');
          return;
        }

        const { videos } = await res.json();

        // ✅ 여기서 총 파일 수 계산
        let count = 0;
        videos.forEach(video => {
          count += 1; // 비디오 썸네일
          if (video.background_music?.file_path) count += 1;
          count += video.tts_tracks?.length || 0;
        });
        setTotalCount(count); // ✅ 총 이미지 개수 설정


        await updateTracksFromProjectInfo(
          videos,
          dispatch,
          setRetryQueue,
          updateProgress,  // ✅ 반드시 네 번째 인자로 추가
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
    const MAX_BOTTOM_HEIGHT = 200;
    const MIN_BOTTOM_HEIGHT = 100;

    const handleHorizontalMouseMove = (e) => {
      if (!isDraggingHorizontal.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerBottom = containerRect.bottom;

      const cursorY = e.clientY;
      const maxAllowedY = containerBottom - MIN_BOTTOM_HEIGHT;
      const minAllowedY = containerBottom - MAX_BOTTOM_HEIGHT;

      // ✅ 막대가 위로 너무 올라가지 않도록
      if (cursorY < minAllowedY || cursorY > maxAllowedY) return;

      let newBottomHeight = containerBottom - cursorY;

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
  const topHeight = `calc(100vh - ${bottomHeight + horizontalSplitterHeight}px)`;
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
                newTracks: [{
                  id: item.trackId,
                  startTime: 0,
                  duration: item.duration,
                  url: item.url,
                  waveformImage: img,
                  delayPx: 0,
                  width: Math.floor(item.duration * 100),
                }]
              }
            });
          } else if (item.type === 'tts') {
            dispatch({
              type: 'ADD_AUDIO_TRACKS',
              payload: {
                trackGroupId: item.groupId,
                newTracks: [{
                  ...item.trackData,
                  waveformImage: img
                }]
              }
            });
          }
        } catch (err) {
          console.warn('❌ 파형 재시도 실패 (보류):', item.url);
          // 실패한 항목은 큐에 다시 넣음 (원하면 제한 조건도 걸 수 있음)
          setRetryQueue(prev => [...prev, item]);
        }
      }
    };

    retryFailedWaveforms();
  }, [retryQueue]);

  return (
    <div>
      {loading && (
        <div className="loading-overlay">
          <div className="spinner" />
        </div>
      )}

      <div style={{ height: '100vh', overflow: 'hidden' }}>  {/* ✅ 전체 화면 고정 및 스크롤 제거 */}
        <div
          className="container"
          ref={containerRef}
          style={{
            gridTemplateRows: `${topHeight} ${horizontalSplitterHeight}px ${bottomHeight}px`,
            backgroundColor: '#2b2d31', // 전체 배경
            color: '#f2f3f5',            // 전체 텍스트 색상
          }}
        >
          {/* 상단 영역: 좌측은 여러 페이지, 우측은 VideoViewer */}
          <div
            className="topRow"
            ref={topRowRef}
            style={{ gridColumn: '1 / span 2', display: 'flex', gap: '10px' }}
          >
            <div
              className="topLeft"
              style={{
                width: `${topLeftWidth}px`,
                display: 'flex', // ✅ 좌우 나누기 위해 flex
                backgroundColor: '#313338',
                color: '#f2f3f5',
                overflow: 'hidden', // ✅ 외부 스크롤 방지
                height: '100%'      // ✅ 상위 row를 꽉 채우도록
              }}
            >
              <nav
                style={{
                  padding: '8px',
                  borderRight: '1px solid #ccc',
                  display: 'flex',
                  flexDirection: 'column',  // 세로 정렬
                  gap: '8px',
                  minWidth: '120px',
                  backgroundColor: '#313338',
                  height: '100%',
                }}
              >

                <NavLink
                  to="/"
                  end
                  style={({ isActive }) => ({
                    fontWeight: isActive ? 'bold' : 'normal',
                    color: isActive ? '#5865f2' : '#f2f3f5',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? '#404249' : 'transparent'
                  })}
                >
                  🏠 Home
                </NavLink>

                <NavLink
                  to="files"
                  end
                  style={({ isActive }) => ({
                    fontWeight: isActive ? 'bold' : 'normal',
                    color: isActive ? '#5865f2' : '#f2f3f5',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? '#404249' : 'transparent'
                  })}
                >
                  Files
                </NavLink>

                <NavLink
                  to="tts2"
                  end
                  style={({ isActive }) => ({
                    fontWeight: isActive ? 'bold' : 'normal',
                    color: isActive ? '#5865f2' : '#f2f3f5',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? '#404249' : 'transparent'
                  })}
                >
                  tts
                </NavLink>

                <NavLink
                  to="script"
                  end
                  style={({ isActive }) => ({
                    fontWeight: isActive ? 'bold' : 'normal',
                    color: isActive ? '#5865f2' : '#f2f3f5',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? '#404249' : 'transparent'
                  })}
                >
                  script
                </NavLink>

                <NavLink
                  to="TTSModel"
                  end
                  style={({ isActive }) => ({
                    fontWeight: isActive ? 'bold' : 'normal',
                    color: isActive ? '#5865f2' : '#f2f3f5',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? '#404249' : 'transparent'
                  })}
                >
                  TTSModel
                </NavLink>
                <NavLink
                  to="Audio"
                  end
                  style={({ isActive }) => ({
                    fontWeight: isActive ? 'bold' : 'normal',
                    color: isActive ? '#5865f2' : '#f2f3f5',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? '#404249' : 'transparent'
                  })}
                >
                  Audio
                </NavLink>
              </nav>


              {/* 중첩 라우트의 컴포넌트를 여기에 렌더링 */}
              <div
                style={{ flex: 1, overflow: 'auto', height: '100%' }} // ✅ 스크롤이 생기도록 설정
                className="hide-scrollbar" // ✅ 스크롤바 숨기기 클래스
              >
                <Outlet context={{ projectId }} />
              </div>


            </div>
            {/* Vertical splitter */}
            <div
              className="vertical-splitter"
              onMouseDown={handleVerticalSplitterMouseDown}
              style={{
                width: `${verticalSplitterWidth}px`,
                backgroundColor: '#404249', // splitter 색상
                cursor: 'col-resize'
              }}
            ></div>
            <div className="topRight" style={{
              flexGrow: 1,
              backgroundColor: '#2b2d31', // Viewer 배경
              color: '#f2f3f5',
              overflow: 'auto' // ✅ 추가

            }}>
              {/* 비디오 뷰어 */}
              <Viewer />
            </div>
          </div>
          {/* Horizontal splitter */}
          <div
            className="horizontal-splitter"
            onMouseDown={handleHorizontalSplitterMouseDown}
            style={{
              gridColumn: '1 / span 2',
              backgroundColor: '#404249', // splitter 색상
              cursor: 'row-resize',
              padding: 0,
              margin: 0,
            }}
          ></div>
          {/* 하단 영역: Track 컴포넌트 */}
          <div
            style={{
              overflowX: 'hidden',   // 가로 스크롤은 허용
              overflowY: 'auto', // 세로 스크롤은 비활성화
              width: '100%',
              height: '100%'
            }}
          >
            <Track />
          </div>

        </div>

      </div>
    </div>
  );
}

export default User;
