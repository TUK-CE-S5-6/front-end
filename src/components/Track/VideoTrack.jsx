// src/components/Track/VideoTracks.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

// 비디오 썸네일 합성 함수 (기존 그대로)
async function generateCompositeThumbnail(file, interval = 1, thumbnailHeight = 90) {
  return new Promise((resolve, reject) => {
    const videoElem = document.createElement('video');
    videoElem.preload = 'metadata';
    videoElem.muted = true;
    videoElem.playsInline = true;
    videoElem.src = URL.createObjectURL(file);

    videoElem.onloadedmetadata = () => {
      const duration = videoElem.duration;
      const fullFrames = Math.floor(duration);
      const remainder = duration - fullFrames;
      const totalWidth = fullFrames * 100 + (remainder > 0 ? Math.ceil(remainder * 100) : 0);

      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = thumbnailHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, totalWidth, thumbnailHeight);

      let currentFrame = 0;
      const captureNextFrame = () => {
        if (currentFrame < fullFrames) {
          videoElem.currentTime = currentFrame;
        } else if (currentFrame === fullFrames && remainder > 0) {
          videoElem.currentTime = fullFrames;
        } else {
          resolve(canvas.toDataURL("image/png"));
          return;
        }
      };

      videoElem.onseeked = () => {
        let frameWidth = 100;
        if (currentFrame === fullFrames && remainder > 0) {
          frameWidth = remainder * 100;
        }
        ctx.drawImage(videoElem, currentFrame * 100, 0, frameWidth, thumbnailHeight);
        currentFrame++;
        captureNextFrame();
      };

      captureNextFrame();
    };

    videoElem.onerror = reject;
  });
}

const VideoTracks = () => {
  const dispatch = useDispatch();
  const videoTracks = useSelector(state => state.videoTracks);
  const timelineDuration = useSelector(state => state.timelineDuration);

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
    trackId: null
  });

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const onClickOutside = () => {
      if (ctxMenu.visible) setCtxMenu(c => ({ ...c, visible: false }));
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
      trackId
    });
  };

  // 메뉴 “Delete” 클릭 시
  const handleDeleteItem = () => {
    dispatch({
      type: 'DELETE_VIDEO_TRACK_ITEM',
      payload: {
        groupId: ctxMenu.groupId,
        trackId: ctxMenu.trackId
      }
    });
    setCtxMenu(c => ({ ...c, visible: false }));
  };
  // 비디오 아이템 드래그 위치 조정
  const handleItemMouseDown = (e, groupId, itemId, initialDelayPx = 0, itemWidth = 100) => {
    const startX = e.clientX;
    let finalDelayPx = initialDelayPx;
    setDraggingItem({ groupId, trackId: itemId, newDelayPx: initialDelayPx });

    const onMouseMove = moveEvent => {
      const delta = moveEvent.clientX - startX;
      let newLeft = initialDelayPx + delta;
      // container width 제한
      const cw = containerRefs.current[groupId]?.offsetWidth || (timelineDuration * 100);
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
          newStartTime
        }
      });
      setDraggingItem(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // 파일 업로드 버튼 클릭
  const handleUploadVideo = groupId => {
    setUploadVideoGroupId(groupId);
    if (videoFileInputRef.current) {
      videoFileInputRef.current.value = null;
      videoFileInputRef.current.click();
    }
    setActiveVideoMenuGroup(null);
  };

  // 파일 선택 후 처리
  const handleVideoFileChange = async e => {
    const file = e.target.files[0];
    if (file && uploadVideoGroupId != null) {
      const fileUrl = URL.createObjectURL(file);
      try {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        video.src = fileUrl;
        await new Promise((res, rej) => {
          video.onloadedmetadata = res;
          video.onerror = rej;
        });
        const duration = video.duration;
        const thumbnail = await generateCompositeThumbnail(file, 1, 100);
        const newItem = {
          id: Date.now(),
          startTime: 0,
          duration,
          url: fileUrl,
          thumbnail,
          delayPx: 0,
          width: Math.ceil(duration * 100),
        };
        dispatch({
          type: 'ADD_VIDEO_TRACKS',
          payload: { trackGroupId: uploadVideoGroupId, newTracks: [newItem] }
        });
      } catch (err) {
        console.error("Error processing video:", err);
      } finally {
        setUploadVideoGroupId(null);
      }
    }
  };

  // 그룹 삭제
  const handleDeleteGroup = groupId => {
    dispatch({ type: 'DELETE_VIDEO_GROUP', payload: groupId });
    setActiveVideoMenuGroup(null);
  };

  // 볼륨 슬라이더 변경
  const handleVolumeSliderChange = (groupId, value) =>
    setLocalVolume(prev => ({ ...prev, [groupId]: value }));

  const handleVolumeSliderMouseUp = groupId => {
    const vol = localVolume[groupId];
    if (vol != null) {
      dispatch({ type: 'CHANGE_VIDEO_VOLUME', payload: { groupId, volume: vol } });
    }
  };

  const handleVolumeToggleVideo = group => {
    const newVol = group.volume > 0 ? 0 : 100;
    setLocalVolume(prev => ({ ...prev, [group.id]: newVol }));
    dispatch({ type: 'CHANGE_VIDEO_VOLUME', payload: { groupId: group.id, volume: newVol } });
  };

  // 그룹 이름 편집
  const startEditingVideoName = group => {
    setEditingVideoGroupId(group.id);
    setEditingVideoName(group.name || '');
  };

  const finishEditingVideoName = groupId => {
    dispatch({ type: 'UPDATE_VIDEO_GROUP_NAME', payload: { groupId, name: editingVideoName } });
    setEditingVideoGroupId(null);
    setEditingVideoName('');
  };

  // 네이티브 Drop 처리
  const handleDrop = (e, groupId) => {
    e.preventDefault();
    const json =
      e.dataTransfer.getData('application/json') ||
      e.dataTransfer.getData('text/plain');
    if (!json) return;

    let data;
    try {
      data = JSON.parse(json);
    } catch {
      return;
    }

    const { url, duration, thumbnailUrl, waveformImage, fileName } = data;

    dispatch({
      type: 'ADD_VIDEO_TRACK_URL',
      payload: {
        trackGroupId: groupId,
        url,
        duration,
        thumbnailUrl,    // dispatch에 thumbnailUrl로 전달
        waveformImage
      }
    });

    alert(
      `"${fileName}" 을(를) 트랙 ${groupId}에 추가했습니다.` +
      (duration ? ` (길이: ${duration.toFixed(2)}초)` : '') +
      (thumbnailUrl ? ' 썸네일도 함께 전달됨' : '')
    );
  };




  return (

    <div>
      <input
        type="file"
        accept="video/*"
        ref={videoFileInputRef}
        style={{ display: 'none' }}
        onChange={handleVideoFileChange}
      />

      {videoTracks.map(group => (
        <div key={group.id} style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', border: '1px solid #ccc' }}>
            {/* 좌측 메뉴 영역 */}
            <div style={{ width: 210, backgroundColor: '#eee', overflow: 'visible' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {editingVideoGroupId === group.id ? (
                  <input
                    type="text"
                    value={editingVideoName}
                    onChange={e => setEditingVideoName(e.target.value)}
                    onBlur={() => finishEditingVideoName(group.id)}
                    onKeyDown={e => e.key === 'Enter' && finishEditingVideoName(group.id)}
                    autoFocus
                    style={{ fontSize: 12, color: '#333' }}
                  />
                ) : (
                  <span
                    style={{ fontSize: 12, color: '#333', cursor: 'pointer' }}
                    onClick={() => startEditingVideoName(group)}
                  >
                    {group.name || 'Video Group'}
                  </span>
                )}
                <div style={{ position: 'relative' }}>
                  <button onClick={() =>
                    setActiveVideoMenuGroup(activeVideoMenuGroup === group.id ? null : group.id)
                  }>
                    :
                  </button>
                  {activeVideoMenuGroup === group.id && (
                    <div style={{
                      position: 'absolute', top: 0, left: '100%', marginLeft: 10,
                      backgroundColor: '#fff', border: '1px solid #ccc', zIndex: 1
                    }}>
                      <button onClick={() => handleUploadVideo(group.id)}>Upload Video</button>
                      <button onClick={() => handleDeleteGroup(group.id)}>Delete Group</button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', height: 40, width: 200 }}>
                <button
                  onClick={() => handleVolumeToggleVideo(group)}
                  style={{
                    width: 40, height: 40, background: 'none',
                    border: 'none', cursor: 'pointer', fontSize: 16, marginRight: 5
                  }}
                >
                  {group.volume === 0 ? '🔇' : '🔊'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={localVolume[group.id] != null ? localVolume[group.id] : group.volume}
                  onChange={e => handleVolumeSliderChange(group.id, parseInt(e.target.value, 10))}
                  onMouseUp={() => handleVolumeSliderMouseUp(group.id)}
                  onTouchEnd={() => handleVolumeSliderMouseUp(group.id)}
                  style={{ width: 'calc(100% - 45px)' }}
                />
              </div>
            </div>

            {/* 우측 트랙 + 네이티브 Drop 영역 */}
            <div
              ref={el => { containerRefs.current[group.id] = el }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, group.id)}
              style={{
                flexGrow: 1, backgroundColor: '#ddd', position: 'relative',
                height: '100px',
                width: `${timelineDuration * 100}px`,
                minWidth: `${timelineDuration * 100}px`,
                overflow: 'hidden'
              }}
            >
              {group.tracks.map(item => {
                const left = draggingItem?.trackId === item.id
                  ? draggingItem.newDelayPx
                  : (item.delayPx || 0);

                return (

                  <div
                    key={item.id}
                    onContextMenu={e => {
                      e.preventDefault();                       // 기본 메뉴 차단
                      handleContextMenu(e, group.id, item.id);  // 내 메뉴 띄우기
                    }}
                    style={{
                      position: 'absolute',
                      left: `${left}px`,
                      top: 0,
                      width: `${item.width || 150}px`,
                      height: '100px',
                      cursor: 'grab',
                      userSelect: 'none'
                    }}
                    onMouseDown={e =>
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
                      draggable={false}                     // ← 브라우저 기본 드래그 방지
                      onDragStart={e => e.preventDefault()} // ← 브라우저 기본 드래그 방지
                      style={{ width: '100%', height: '100%' }}
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
            background: '#fff',
            border: '1px solid #ccc',
            padding: 4,
            zIndex: 1000
          }}
        >
          <button onClick={handleDeleteItem} style={{ cursor: 'pointer' }}>
            Delete Video Item
          </button>
        </div>
      )}

    </div>
  );
};

export default VideoTracks;
