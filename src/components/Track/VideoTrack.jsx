// src/components/Track/VideoTracks.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

const API_BASE = 'http://175.116.3.178:8000'; // 같은 오리진이면 빈 문자열. 다르면 'http://localhost:8000' 등으로.

const VideoTracks = () => {
  const dispatch = useDispatch();
  const videoTracks = useSelector((state) => state.videoTracks);
  const timelineDuration = useSelector((state) => state.timelineDuration);

  const videoFileInputRef = useRef(null);
  const containerRefs = useRef({});

  const [uploadVideoGroupId, setUploadVideoGroupId] = useState(null);
  const [activeVideoMenuGroup, setActiveVideoMenuGroup] = useState(null);
  const [editingVideoGroupId, setEditingVideoGroupId] = useState(null);
  const [editingVideoName, setEditingVideoName] = useState('');
  const [draggingItem, setDraggingItem] = useState(null);
  const [localVolume, setLocalVolume] = useState({});

  const [ctxMenu, setCtxMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    groupId: null,
    trackId: null,
  });

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const onClickOutside = () => {
      if (ctxMenu.visible) setCtxMenu((c) => ({ ...c, visible: false }));
    };
    window.addEventListener('click', onClickOutside);
    return () => window.removeEventListener('click', onClickOutside);
  }, [ctxMenu.visible]);

  // 우클릭 핸들러
  const handleContextMenu = (e, groupId, trackId) => {
    e.preventDefault();
    setCtxMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      groupId,
      trackId,
    });
  };

  // 메뉴 “Delete” 클릭 시
  const handleDeleteItem = () => {
    dispatch({
      type: 'DELETE_VIDEO_TRACK_ITEM',
      payload: {
        groupId: ctxMenu.groupId,
        trackId: ctxMenu.trackId,
      },
    });
    setCtxMenu((c) => ({ ...c, visible: false }));
  };

  // 비디오 아이템 드래그 위치 조정
  const handleItemMouseDown = (
    e,
    groupId,
    itemId,
    initialDelayPx = 0,
    itemWidth = 100
  ) => {
    const startX = e.clientX;
    let finalDelayPx = initialDelayPx;
    setDraggingItem({ groupId, trackId: itemId, newDelayPx: initialDelayPx });

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      let newLeft = initialDelayPx + delta;
      const cw =
        containerRefs.current[groupId]?.offsetWidth || timelineDuration * 100;
      newLeft = Math.max(0, Math.min(newLeft, cw - itemWidth));
      finalDelayPx = newLeft;
      setDraggingItem({ groupId, trackId: itemId, newDelayPx: newLeft });
    };

    const onMouseUp = () => {
      const newStartTime = Number((finalDelayPx * 0.01).toFixed(2));
      dispatch({
        type: 'UPDATE_VIDEO_TRACK_ITEM',
        payload: {
          groupId,
          trackId: itemId,
          newDelayPx: finalDelayPx,
          newStartTime,
        },
      });
      setDraggingItem(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // 파일 업로드 버튼 클릭
  const handleUploadVideo = (groupId) => {
    setUploadVideoGroupId(groupId);
    if (videoFileInputRef.current) {
      videoFileInputRef.current.value = null;
      videoFileInputRef.current.click();
    }
    setActiveVideoMenuGroup(null);
  };

  // 파일 선택 후 처리 (← 서버 생성 썸네일 사용)
  const handleVideoFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && uploadVideoGroupId != null) {
      try {
        const form = new FormData();
        form.append('file', file);

        // 서버에서 sprite.png 생성하고 메타 반환
        const res = await fetch(`${API_BASE}/api/videos/upload`, {
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || 'Upload failed');
        }
        const data = await res.json();
        // data: { id, video_url, duration, width_px, thumbnail_url, file_name }

        const newItem = {
          id: data.id || Date.now(),
          startTime: 0,
          duration: data.duration,
          url: `${API_BASE}${data.video_url}`, // 비디오 파일 URL
          thumbnail: `${API_BASE}${data.thumbnail_url}`, // 서버 합성 스프라이트 PNG
          delayPx: 0,
          width: data.width_px,
        };

        dispatch({
          type: 'ADD_VIDEO_TRACKS',
          payload: { trackGroupId: uploadVideoGroupId, newTracks: [newItem] },
        });
      } catch (err) {
        console.error('Error uploading video:', err);
        alert('업로드 중 오류가 발생했습니다.');
      } finally {
        setUploadVideoGroupId(null);
      }
    }
  };

  // 그룹 삭제
  const handleDeleteGroup = (groupId) => {
    dispatch({ type: 'DELETE_VIDEO_GROUP', payload: groupId });
    setActiveVideoMenuGroup(null);
  };

  // 볼륨 슬라이더 변경
  const handleVolumeSliderChange = (groupId, value) =>
    setLocalVolume((prev) => ({ ...prev, [groupId]: value }));

  const handleVolumeSliderMouseUp = (groupId) => {
    const vol = localVolume[groupId];
    if (vol != null) {
      dispatch({
        type: 'CHANGE_VIDEO_VOLUME',
        payload: { groupId, volume: vol },
      });
    }
  };

  const handleVolumeToggleVideo = (group) => {
    const newVol = group.volume > 0 ? 0 : 100;
    setLocalVolume((prev) => ({ ...prev, [group.id]: newVol }));
    dispatch({
      type: 'CHANGE_VIDEO_VOLUME',
      payload: { groupId: group.id, volume: newVol },
    });
  };

  // 그룹 이름 편집
  const startEditingVideoName = (group) => {
    setEditingVideoGroupId(group.id);
    setEditingVideoName(group.name || '');
  };

  const finishEditingVideoName = (groupId) => {
    dispatch({
      type: 'UPDATE_VIDEO_GROUP_NAME',
      payload: { groupId, name: editingVideoName },
    });
    setEditingVideoGroupId(null);
    setEditingVideoName('');
  };

  //비디오 만드는 것
  // URL 유틸
  const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
  const toAbsUrl = (u, base = API_BASE) => {
    if (!u) return '';
    if (isHttp(u)) return u;
    return u.startsWith('/') ? `${base}${u}` : u;
  };

  // 비디오 메타(길이 등) 읽기
  async function getVideoMeta(url) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      let timeoutId;

      const cleanup = () => {
        clearTimeout(timeoutId);
        try { video.src = ''; video.load(); } catch { }
      };

      video.preload = 'metadata';
      video.src = url;

      timeoutId = setTimeout(() => {
        console.warn('getVideoMeta timeout');
        cleanup();
        resolve({ duration: 0, videoWidth: 0, videoHeight: 0 });
      }, 8000);

      video.onloadedmetadata = () => {
        const out = {
          duration: Number(video.duration) || 0,
          videoWidth: video.videoWidth || 0,
          videoHeight: video.videoHeight || 0,
        };
        cleanup();
        resolve(out);
      };

      video.onerror = () => {
        console.warn('getVideoMeta error');
        cleanup();
        resolve({ duration: 0, videoWidth: 0, videoHeight: 0 });
      };
    });
  }

  // 드래그용 스프라이트(2초 간격) 생성: 실패 시 null
async function generateSprite(
  url,
  intervalSec = 2,
  frameW = 120,
  frameH = Math.round((120 * 9) / 16)
) {
  return new Promise((resolve, reject) => {
    // 🎯 URL 유효성 검사
    if (!url || (!url.endsWith('.mp4') && !url.endsWith('.webm'))) {
      console.warn('generateSprite invalid URL', url);
      resolve(null);
      return;
    }

    const video = document.createElement('video');
    let timeoutId;

    const cleanup = () => {
      clearTimeout(timeoutId);
      try {
        video.src = '';
        video.load();
      } catch {}
    };

    timeoutId = setTimeout(() => {
      console.warn('generateSprite timeout');
      cleanup();
      resolve(null);
    }, 10000);

    video.crossOrigin = 'anonymous'; // CORS 허용 시 캔버스 사용 가능
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;

    video.onloadedmetadata = () => {
      const duration = Number(video.duration) || 0;
      if (duration <= 0 || !isFinite(duration)) {
        cleanup();
        resolve(null);
        return;
      }

      const count = Math.ceil(duration / intervalSec);
      const lastSec = duration - intervalSec * (count - 1);
      const lastW = (frameW * Math.max(0, lastSec)) / intervalSec;

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(frameW * (count - 1) + Math.max(1, lastW));
      canvas.height = frameH;
      const ctx = canvas.getContext('2d');

      let idx = 0;
      video.onseeked = () => {
        try {
          const isLast = idx >= count - 1;
          const w = isLast ? Math.max(1, Math.floor(lastW)) : frameW;
          ctx.drawImage(
            video,
            0,
            0,
            video.videoWidth,
            video.videoHeight,
            idx * frameW,
            0,
            w,
            frameH
          );
        } catch (e) {
          console.warn('drawImage failed', e);
          cleanup();
          resolve(null);
          return;
        }
        idx++;
        if (idx < count) {
          video.currentTime = Math.min(idx * intervalSec, duration);
        } else {
          const data = canvas.toDataURL('image/png');
          cleanup();
          resolve(data);
        }
      };

      // 일부 브라우저는 loadeddata 이후 시킹이 안정적
      video.onloadeddata = () => {
        try {
          video.currentTime = 0;
        } catch {}
      };
    };

    video.onerror = () => {
  if (video.__errorHandled) return; // 중복 방지
  video.__errorHandled = true;

  console.warn('generateSprite video error', video.src);

  video.onerror = null; // 이벤트 제거
  video.onloadedmetadata = null;
  video.onseeked = null;
  video.onloadeddata = null;

  cleanup();
  reject(new Error('Video load failed'));
};
  });
}



  const handleDrop = async (e, groupId) => {
    e.preventDefault();
    const raw =
      e.dataTransfer.getData('application/json') ||
      e.dataTransfer.getData('text/plain');
    if (!raw) return;

    let data = {};
    try { data = JSON.parse(raw); } catch { data = { url: raw }; }
    if (!data?.url) return;

    // 1) URL 정규화
    const url = toAbsUrl(data.url, API_BASE);
    // 2) 메타(길이) 확보: payload에 duration이 없으면 직접 읽음
    let duration = Number(data.duration) || 0;
    if (!duration) {
      const meta = await getVideoMeta(url);
      duration = meta.duration || 0;
    }
    // 3) 썸네일 결정: payload 썸네일 > 스프라이트 생성 > 파형 > 플레이스홀더
    let thumbnail =
      (isHttp(data.thumbnailUrl) ? data.thumbnailUrl : null) ||
      (isHttp(data.thumbnail) ? data.thumbnail : null) ||
      null;
    if (!thumbnail) {
      try {
        // 캔버스 스프라이트 생성 (코덱/시킹 실패 시 null)
        thumbnail = await generateSprite(url);
      } catch { /* ignore */ }
    }
    if (!thumbnail && data.waveformImage) {
      thumbnail = data.waveformImage; // dataURL 허용(표시용)
    }
    if (!thumbnail) {
      thumbnail = `${API_BASE}/thumbnails/audio-placeholder.png`;
    }

    // 4) width 계산: 1초=100px 규칙, 최소 150px
    const width = Math.max(150, Math.round((duration || 1) * 100));

    // 5) 아이템 추가
    const newItem = {
      id: Date.now(),
      startTime: 0,
      duration,
      url,
      thumbnail,   // dataURL 또는 http(s) URL
      delayPx: 0,
      width,
    };
    dispatch({
      type: 'ADD_VIDEO_TRACKS',
      payload: { trackGroupId: groupId, newTracks: [newItem] },
    });

    // 가벼운 로그
    console.log(`[DROP→ADD] ${data.fileName || 'video'} into group=${groupId}, duration=${duration}s`);
  };

  return (
    <div style={{ backgroundColor: '#15151e', color: '#e5e7eb' }}>
      <input
        type="file"
        accept="video/*"
        ref={videoFileInputRef}
        style={{ display: 'none' }}
        onChange={handleVideoFileChange}
      />

      {videoTracks.map((group) => (
        <div key={group.id} style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', border: '1px solid #2b2b36', background: '#0f0f17' }}>
            {/* 좌측 메뉴 영역 */}
            <div
              style={{
                width: 210,
                backgroundColor: '#111118',
                overflow: 'visible',
                borderRight: '1px solid #2b2b36',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#2a2a3b',
                  borderBottom: '1px solid #2b2b36',
                  color: '#e5e7eb',
                }}
              >
                {editingVideoGroupId === group.id ? (
                  <input
                    type="text"
                    value={editingVideoName}
                    onChange={(e) => setEditingVideoName(e.target.value)}
                    onBlur={() => finishEditingVideoName(group.id)}
                    onKeyDown={(e) => e.key === 'Enter' && finishEditingVideoName(group.id)}
                    autoFocus
                    style={{
                      fontSize: 12,
                      color: '#e5e7eb',
                      background: '#1b1b28',
                      border: '1px solid #2b2b36',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <span
                    style={{ fontSize: 12, color: '#ffffff', cursor: 'pointer' }}
                    onClick={() => startEditingVideoName(group)}
                  >
                    {group.name || 'Video Group'}
                  </span>
                )}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() =>
                      setActiveVideoMenuGroup(
                        activeVideoMenuGroup === group.id ? null : group.id
                      )
                    }
                    style={{
                      color: '#c9c9d4',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    title="그룹 메뉴"
                  >
                    ⋯
                  </button>
                  {activeVideoMenuGroup === group.id && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: '100%',
                        marginLeft: 10,
                        backgroundColor: '#1b1b28',
                        border: '1px solid #2b2b36',
                        color: '#e5e7eb',
                        zIndex: 1,
                        boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
                      }}
                    >
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          color: '#e5e7eb',
                          cursor: 'pointer',
                          padding: 8,
                          textAlign: 'left',
                        }}
                      >
                        <i className="fi fi-ss-trash-xmark"></i>
                        Delete
                      </button>
                    </div>

                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 40,
                  width: 200,
                  background: '#111118',
                  color: '#c9c9d4',
                }}
              >

                <button
                  onClick={() => handleVolumeToggleVideo(group)}
                  style={{
                    width: 40,
                    height: 40,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    marginRight: 5,
                    color: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="음소거 토글"
                >
                  <i
                    className={group.volume === 0 ? 'fi fi-ss-volume-mute' : 'fi fi-ss-volume'}
                    style={{ fontSize: 18, lineHeight: 1 }}
                  />
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={localVolume[group.id] != null ? localVolume[group.id] : group.volume}
                  onChange={(e) => handleVolumeSliderChange(group.id, parseInt(e.target.value, 10))}
                  onMouseUp={() => handleVolumeSliderMouseUp(group.id)}
                  onTouchEnd={() => handleVolumeSliderMouseUp(group.id)}
                  style={{
                    width: 'calc(100% - 45px)',
                    accentColor: '#6b6ddf',
                  }}
                />
              </div>
            </div>

            {/* 우측 트랙 + 네이티브 Drop 영역 */}
            <div
              ref={(el) => {
                containerRefs.current[group.id] = el;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, group.id)}
              style={{
                flexGrow: 1,
                backgroundColor: '#1b1b28',
                position: 'relative',
                height: '100px',
                width: `${timelineDuration * 100}px`,
                minWidth: `${timelineDuration * 100}px`,
                overflow: 'hidden',
                borderLeft: '1px solid #2b2b36',
              }}
            >
              {group.tracks.map((item) => {
                const left =
                  draggingItem?.trackId === item.id
                    ? draggingItem.newDelayPx
                    : item.delayPx || 0;
                return (
                  <div
                    key={item.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleContextMenu(e, group.id, item.id);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${left}px`,
                      top: 0,
                      width: `${item.width || 150}px`,
                      height: '100px',
                      cursor: 'grab',
                      userSelect: 'none',
                      borderRadius: 6,
                      overflow: 'hidden',
                      boxSizing: 'border-box',

                      // ✨ 오디오트랙과 동일한 좌/우 테두리(진한 파스텔 보라)
                      borderLeft: '4px solid #C084FC',
                      borderRight: '4px solid #C084FC',
                      borderTop: 'none',
                      borderBottom: 'none',

                      // 필요 시 배경 투명(또는 트랙 색상과 동일)으로
                      // background: 'transparent',
                      // background: '#1b1b28',
                    }}
                    onMouseDown={(e) =>
                      handleItemMouseDown(
                        e,
                        group.id,
                        item.id,
                        item.delayPx,
                        item.width || 150
                      )
                    }
                  >
                    <img
                      src={item.thumbnail}
                      alt="thumb"
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        boxShadow: 'none',
                        filter: 'none',
                      }}
                    />
                  </div>
                );

              })}
            </div>
          </div>
        </div>
      ))}

      {ctxMenu.visible && (
        <div
          style={{
            position: 'fixed',
            top: ctxMenu.y,
            left: ctxMenu.x,
            background: '#1b1b28',
            border: '1px solid #2b2b36',
            padding: 4,
            zIndex: 1000,
            color: '#e5e7eb',
            boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
          }}
        >
          <button
            onClick={handleDeleteItem}
            style={{
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              color: '#e5e7eb',
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="fi fi-ss-trash-xmark"></i>
            Delete Video
          </button>
        </div>
      )}
    </div>
  );

};

export default VideoTracks;
