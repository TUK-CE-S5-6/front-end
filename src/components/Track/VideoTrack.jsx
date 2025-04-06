import React, { useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

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
        const xPos = currentFrame * 100;
        ctx.drawImage(videoElem, xPos, 0, frameWidth, thumbnailHeight);
        currentFrame++;
        captureNextFrame();
      };
      
      captureNextFrame();
    };
    
    videoElem.onerror = (err) => {
      reject(err);
    };
  });
}

const VideoTracks = () => {
  const dispatch = useDispatch();
  const videoTracks = useSelector(state => state.videoTracks);
  // 전역 timelineDuration 값을 Redux에서 가져옵니다.
  const timelineDuration = useSelector(state => state.timelineDuration);
  const [uploadVideoGroupId, setUploadVideoGroupId] = useState(null);
  const [activeVideoMenuGroup, setActiveVideoMenuGroup] = useState(null);
  const [editingVideoGroupId, setEditingVideoGroupId] = useState(null);
  const [editingVideoName, setEditingVideoName] = useState('');
  const videoFileInputRef = useRef(null);
  
  // 드래그 중인 아이템의 위치를 로컬 상태로 관리
  const [draggingItem, setDraggingItem] = useState(null);
  // 각 그룹의 볼륨 슬라이더 값을 로컬 상태로 관리 (Redux 업데이트는 드래그 종료 시)
  const [localVolume, setLocalVolume] = useState({});
  // 회색 영역(우측 트랙 영역)의 ref 추가
  const containerRef = useRef(null);

  // placeholder 비디오 아이템 추가 함수
  const addVideoItem = (groupId) => {
    const newItem = {
      id: Date.now(),
      startTime: 0,
      duration: 10,
      url: "video-placeholder.mp4",
      thumbnail: "https://via.placeholder.com/150x80?text=Thumbnail",
      delayPx: 0,
      width: 20,
    };
    dispatch({
      type: 'ADD_VIDEO_TRACKS',
      payload: {
        trackGroupId: groupId,
        newTracks: [newItem]
      }
    });
  };

  // 드래그 이벤트: 로컬 상태를 사용하여 위치 업데이트 후 드래그 종료 시 한 번만 Redux 업데이트
  const handleItemMouseDown = (e, groupId, itemId, currentDelayPx = 0, itemWidth = 100) => {
    const startX = e.clientX;
    const initialLeft = currentDelayPx;
    let finalDelayPx = currentDelayPx;

    setDraggingItem({
      groupId,
      trackId: itemId,
      newDelayPx: currentDelayPx,
    });

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      let newLeft = initialLeft + delta;
      // 회색 영역 내에서만 이동하도록 제한
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        newLeft = Math.max(0, Math.min(newLeft, containerWidth - itemWidth));
      }
      finalDelayPx = newLeft;
      setDraggingItem(prev => ({
        ...prev,
        newDelayPx: newLeft,
      }));
    };

    const onMouseUp = () => {
      const finalStartTime = finalDelayPx * 0.01;
      dispatch({
        type: 'UPDATE_VIDEO_TRACK_ITEM',
        payload: { groupId, trackId: itemId, newDelayPx: finalDelayPx, newStartTime: finalStartTime }
      });
      setDraggingItem(null);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // 파일 선택 창 열기
  const handleUploadVideo = (groupId) => {
    setUploadVideoGroupId(groupId);
    if (videoFileInputRef.current) {
      videoFileInputRef.current.value = null;
      videoFileInputRef.current.click();
    }
    setActiveVideoMenuGroup(null);
  };

  // 파일 선택 후 처리: 썸네일 생성 후 비디오 아이템 추가
  const handleVideoFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && uploadVideoGroupId) {
      const fileUrl = URL.createObjectURL(file);
      try {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        video.src = fileUrl;
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = reject;
        });
        const duration = video.duration;
        const thumbnail = await generateCompositeThumbnail(file, 1, 90);
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
          payload: {
            trackGroupId: uploadVideoGroupId,
            newTracks: [newItem]
          }
        });
        setUploadVideoGroupId(null);
      } catch (error) {
        console.error("Error processing video file:", error);
      }
    }
  };

  // 비디오 그룹 삭제 기능
  const handleDeleteGroup = (groupId) => {
    dispatch({
      type: 'DELETE_VIDEO_GROUP',
      payload: groupId
    });
    setActiveVideoMenuGroup(null);
  };

  // 볼륨 슬라이더 로컬 상태 업데이트 (드래그 중)
  const handleVolumeSliderChange = (groupId, value) => {
    setLocalVolume(prev => ({ ...prev, [groupId]: value }));
  };

  // 볼륨 슬라이더 드래그 종료 시 최종값을 Redux에 업데이트
  const handleVolumeSliderMouseUp = (groupId) => {
    const finalVolume = localVolume[groupId];
    if (finalVolume !== undefined) {
      dispatch({
        type: 'CHANGE_VIDEO_VOLUME',
        payload: { groupId, volume: finalVolume }
      });
    }
  };

  // 볼륨 토글 (0과 100 사이)
  const handleVolumeToggleVideo = (group) => {
    const newVolume = group.volume > 0 ? 0 : 100;
    setLocalVolume(prev => ({ ...prev, [group.id]: newVolume }));
    dispatch({
      type: 'CHANGE_VIDEO_VOLUME',
      payload: { groupId: group.id, volume: newVolume }
    });
  };

  // 비디오 그룹 이름 편집 기능
  const startEditingVideoName = (group) => {
    setEditingVideoGroupId(group.id);
    setEditingVideoName(group.name || '');
  };

  const finishEditingVideoName = (groupId) => {
    dispatch({
      type: 'UPDATE_VIDEO_GROUP_NAME',
      payload: { groupId, name: editingVideoName }
    });
    setEditingVideoGroupId(null);
    setEditingVideoName('');
  };

  return (
    <div>
      {/* 숨겨진 비디오 파일 input */}
      <input 
        type="file" 
        accept="video/*" 
        ref={videoFileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleVideoFileChange} 
      />
      {videoTracks.map(group => (
        <div key={group.id} style={{ marginBottom: '0px' }}>
          <div style={{ display: 'flex', border: '1px solid #ccc' }}>
            {/* 좌측 메뉴 영역 */}
            <div style={{ width: '210px', backgroundColor: '#eee', overflow: 'visible' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {editingVideoGroupId === group.id ? (
                  <input
                    type="text"
                    value={editingVideoName}
                    onChange={(e) => setEditingVideoName(e.target.value)}
                    onBlur={() => finishEditingVideoName(group.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') finishEditingVideoName(group.id); }}
                    autoFocus
                    style={{ fontSize: '12px', color: '#333' }}
                  />
                ) : (
                  <span
                    style={{ fontSize: '12px', color: '#333', cursor: 'pointer' }}
                    onClick={() => startEditingVideoName(group)}
                  >
                    {group.name || 'Video Group'}
                  </span>
                )}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setActiveVideoMenuGroup(activeVideoMenuGroup === group.id ? null : group.id)}>
                    :
                  </button>
                  {activeVideoMenuGroup === group.id && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: '100%',
                      marginLeft: '10px',
                      backgroundColor: '#fff',
                      border: '1px solid #ccc',
                      zIndex: 1
                    }}>
                      <button onClick={() => handleUploadVideo(group.id)}>Upload Video</button>
                      <button onClick={() => handleDeleteGroup(group.id)}>Delete Group</button>
                    </div>
                  )}
                </div>
              </div>
              {/* 볼륨 슬라이더와 스피커 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', height: '40px', width: '200px' }}>
                <button 
                  onClick={() => handleVolumeToggleVideo(group)}
                  style={{ width: '40px', height: '40px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', marginRight: '5px' }}
                >
                  {group.volume === 0 ? '🔇' : '🔊'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={localVolume[group.id] !== undefined ? localVolume[group.id] : group.volume}
                  onChange={(e) => handleVolumeSliderChange(group.id, parseInt(e.target.value, 10))}
                  onMouseUp={() => handleVolumeSliderMouseUp(group.id)}
                  onTouchEnd={() => handleVolumeSliderMouseUp(group.id)}
                  style={{ width: 'calc(100% - 45px)' }}
                />
              </div>
            </div>
            {/* 우측 트랙 영역 (회색 영역) - timelineDuration을 기반으로 너비 설정 */}
            <div
              ref={containerRef}
              style={{
                flexGrow: 1,
                backgroundColor: '#ddd',
                position: 'relative',
                height: '120px',
                width: `${timelineDuration * 100}px`,
                flexShrink: 0,
                minWidth: `${timelineDuration * 100}px`
              }}
            >
              {group.tracks.map(item => {
                const leftValue = draggingItem && draggingItem.trackId === item.id
                  ? draggingItem.newDelayPx
                  : (item.delayPx || 0);
                return (
                  <div
                    key={item.id}
                    style={{
                      position: 'absolute',
                      left: `${leftValue}px`,
                      width: `${item.width || 150}px`,
                      cursor: 'grab',
                      userSelect: 'none'
                    }}
                    onMouseDown={(e) =>
                      handleItemMouseDown(e, group.id, item.id, item.delayPx, item.width || 150)
                    }
                  >
                    <div style={{ pointerEvents: draggingItem && draggingItem.trackId === item.id ? 'none' : 'auto' }}>
                      <img
                        src={item.thumbnail}
                        alt="video thumbnail"
                        style={{ width: '100%', height: 'auto' }}
                      />
                      <div style={{ fontSize: '10px', color: '#000' }}>
                        <p>Start: {(leftValue * 0.01).toFixed(2)}s</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default VideoTracks;
