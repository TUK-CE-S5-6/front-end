// src/components/Track/AudioTracks.jsx
import React, { useRef, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';

const GAP_PX = 2;          // 아이템 간 최소 간격
const SNAP_STICKY = 8;     // 겹침 깊이가 이 이상이면 스냅 발동
const STICK_HYST = 8;      // 스냅된 뒤 이 범위 내에서는 계속 붙어있게
const EPS = 0.5;           // 미세 이동 무시 임계

// ✅ (백업용) 클라에서 파형 생성 — 서버 파형이 없을 때만 사용
const generateWaveformImage = (audioBuffer, width, height) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#007bff';
    const rawData = audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.max(1, Math.floor(rawData.length / width));
    for (let i = 0; i < width; i++) {
      let sum = 0;
      for (let j = 0; j < samplesPerPixel; j++) {
        const idx = i * samplesPerPixel + j;
        if (idx < rawData.length) sum += Math.abs(rawData[idx]);
      }
      const avg = sum / samplesPerPixel;
      const barHeight = avg * height;
      ctx.fillRect(i, (height - barHeight) / 2, 1, barHeight);
    }
    resolve(canvas.toDataURL());
  });
};

const AudioTracks = () => {
  const GAP_PX = 2; // 아이템 사이 최소 간격(px). 0으로 두면 딱 붙게
  const dispatch = useDispatch();
  const audioTracks = useSelector((state) => state.audioTracks);
  const timelineDuration = useSelector((state) => state.timelineDuration);
  const storeState = useSelector((state) => state); // 디버깅용

  const fileInputRef = useRef(null);
  const containerRefs = useRef({});

  const [uploadGroupId, setUploadGroupId] = useState(null);
  const [activeMenuGroup, setActiveMenuGroup] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [draggingItem, setDraggingItem] = useState(null);
  const [localVolume, setLocalVolume] = useState({});

  // ✅ 컨텍스트 메뉴 상태
  const [ctxMenu, setCtxMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    groupId: null,
    trackId: null,
  });

  // 외부 클릭 시 컨텍스트 메뉴 닫기
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
    setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, groupId, trackId });
  };

  // 삭제 버튼 클릭
  const handleDeleteItem = () => {
    dispatch({
      type: 'DELETE_AUDIO_TRACK_ITEM',
      payload: { groupId: ctxMenu.groupId, trackId: ctxMenu.trackId },
    });
    setCtxMenu((c) => ({ ...c, visible: false }));
  };

  // ✅ 서버/외부에서 드랍된 항목을 수신 (waveformUrl 지원)
  const handleDropAudio = (e, groupId) => {
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

    // 서버가 보내는 필드 예: { url, duration, waveformUrl, thumbnailUrl, fileName }
    // 클라 구버전과 호환 위해 waveformImage도 같이 세팅
    const {
      url,
      duration,
      waveformUrl = '',
      waveformImage = '',
      thumbnailUrl,
      fileName,
    } = data;

    dispatch({
      type: 'ADD_AUDIO_TRACK_URL',
      payload: {
        trackGroupId: groupId,
        url,
        duration,
        waveformUrl, // ✅ 서버 파형 URL
        waveformImage, // (백업) 로컬 dataURL
        thumbnailUrl,
      },
    });

    alert(
      `"${fileName || url}" 을(를) 오디오 트랙 ${groupId}에 추가했습니다.` +
      (waveformUrl
        ? ' (서버 파형 사용)'
        : waveformImage
          ? ' (클라 파형 사용)'
          : '')
    );
  };

  // 아이템 드래그 이동
  const handleItemMouseDown = (e, groupId, itemId, currentDelayPx = 0, itemWidth = 100) => {
    const startX = e.clientX;
    let finalDelayPx = currentDelayPx;

    setDraggingItem({ groupId, trackId: itemId, newDelayPx: currentDelayPx });

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;

      // 컨테이너 폭
      const container = containerRefs.current[groupId];
      const cw = container?.offsetWidth ?? timelineDuration * 100;

      // 👇 형제 아이템 검사/클램프 전부 제거! (겹침 허용)
      // 컨테이너 경계만 클램프
      const newLeft = Math.max(0, Math.min(currentDelayPx + delta, cw - itemWidth));

      finalDelayPx = newLeft;
      setDraggingItem(prev => ({ ...prev, newDelayPx: newLeft }));
    };

    const onMouseUp = () => {
      const finalStartTime = Number((finalDelayPx * 0.01).toFixed(2));
      dispatch({
        type: 'UPDATE_AUDIO_TRACK_ITEM',
        payload: { groupId, trackId: itemId, newDelayPx: finalDelayPx, newStartTime: finalStartTime },
      });
      setDraggingItem(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };





  // 파일 업로드 버튼 클릭
  const handleUploadAudio = (groupId) => {
    setUploadGroupId(groupId);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
      fileInputRef.current.click();
    }
    setActiveMenuGroup(null);
  };

  // 파일 선택 후 처리 (서버 파형이 없는 경우를 대비해 로컬 파형 생성)
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && uploadGroupId != null) {
      const fileUrl = URL.createObjectURL(file);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const tempCtx = new AudioContext();
        const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
        const duration = audioBuffer.duration;
        const width = Math.floor(duration * 100);
        const waveformImage = await generateWaveformImage(
          audioBuffer,
          width,
          100
        ); // 백업용
        const newItem = {
          id: Date.now(),
          startTime: 0,
          duration,
          url: fileUrl,
          // 서버 파형 없음 → waveformUrl 미설정
          waveformImage,
          delayPx: 0,
          width,
        };
        dispatch({
          type: 'ADD_AUDIO_TRACKS',
          payload: { trackGroupId: uploadGroupId, newTracks: [newItem] },
        });
        tempCtx.close();
      } catch (err) {
        console.error('Error processing audio file:', err);
      } finally {
        setUploadGroupId(null);
      }
    }
  };

  const handleDeleteGroup = (groupId) => {
    dispatch({ type: 'DELETE_AUDIO_GROUP', payload: groupId });
    setActiveMenuGroup(null);
  };

  const handleVolumeChange = (groupId, value) =>
    setLocalVolume((prev) => ({ ...prev, [groupId]: value }));

  const handleVolumeMouseUp = (groupId) => {
    const vol = localVolume[groupId];
    if (vol != null) {
      dispatch({
        type: 'CHANGE_AUDIO_VOLUME',
        payload: { groupId, volume: vol },
      });
    }
  };

  const toggleVolume = (group) => {
    const newVol = group.volume > 0 ? 0 : 100;
    setLocalVolume((prev) => ({ ...prev, [group.id]: newVol }));
    dispatch({
      type: 'CHANGE_AUDIO_VOLUME',
      payload: { groupId: group.id, volume: newVol },
    });
  };

  const startEditName = (group) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const finishEditName = (groupId) => {
    dispatch({
      type: 'UPDATE_AUDIO_GROUP_NAME',
      payload: { groupId, name: editingName },
    });
    setEditingGroupId(null);
    setEditingName('');
  };

  return (
    <div style={{ backgroundColor: '#15151e', color: '#e5e7eb' }}>
      <input
        type="file"
        accept="audio/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {audioTracks.map((group) => (
        <div key={group.id} style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', border: '1px solid #2b2b36', background: '#0f0f17' }}>
            {/* 좌측 메뉴 영역 */}
            <div
              style={{
                width: 210,
                backgroundColor: '#111118',
                overflow: 'visible',
                left: 0,
                top: 0,
                zIndex: 2,
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
                {editingGroupId === group.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => finishEditName(group.id)}
                    onKeyDown={(e) => e.key === 'Enter' && finishEditName(group.id)}
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
                    onClick={() => startEditName(group)}
                  >
                    {group.name}
                  </span>
                )}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() =>
                      setActiveMenuGroup(activeMenuGroup === group.id ? null : group.id)
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
                  {activeMenuGroup === group.id && (
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
                  onClick={() => toggleVolume(group)}
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
                  onChange={(e) => handleVolumeChange(group.id, parseInt(e.target.value, 10))}
                  onMouseUp={() => handleVolumeMouseUp(group.id)}
                  onTouchEnd={() => handleVolumeMouseUp(group.id)}
                  style={{
                    width: 'calc(100% - 45px)',
                    accentColor: '#6b6ddf',
                  }}
                />
              </div>
            </div>

            {/* 우측 트랙 + DropZone */}
            <div
              ref={(el) => {
                containerRefs.current[group.id] = el;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropAudio(e, group.id)}
              style={{
                flexGrow: 1,
                backgroundColor: '#1b1b28',
                position: 'relative',
                height: '100px',
                width: `${timelineDuration * 100}px`, // 1초 = 100px
                minWidth: `${timelineDuration * 100}px`,
                overflowX: 'visible', // (오타 수정) overflowx -> overflowX
                borderLeft: '1px solid #2b2b36',
              }}
            >
              {group.tracks.map((item) => {
                const left =
                  draggingItem?.trackId === item.id
                    ? draggingItem.newDelayPx
                    : item.delayPx || 0;

                const imgSrc = item.waveformUrl || item.waveformImage;

                // (옵션) 내부 눈금: 1초=100px 기준
                const tickCount = Math.max(0, Math.floor((item.width || 150) / 100));

                return (
                  <div
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleContextMenu(e, group.id, item.id);
                    }}
                    key={item.id}
                    style={{
                      position: 'absolute',
                      left: `${left}px`,
                      top: 0,
                      width: `${item.width || 150}px`,
                      height: '100px',
                      cursor: 'grab',
                      userSelect: 'none',

                      // ✅ 추가/변경된 부분: 경계가 또렷해지도록    테두리 색상 굵기  
                      borderRadius: 6,
                      // 보라톤 고정
                      // 아주 밝은 네온 퍼플
                      borderLeft: '4px solid #C084FC',
                      borderRight: '4px solid #C084FC',
                      borderTop: 'none',
                      borderBottom: 'none',
                      background: 'transparent',     // ← 혹은
                      boxSizing: 'border-box',
                      overflow: 'hidden',
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
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt="audio waveform"
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          color: '#8a8fa3',
                          background: '#111118',
                          border: '1px dashed #2b2b36',
                        }}
                      >
                        (파형 없음)
                      </div>
                    )}

                    {/* ✅ 좌/우 구분선 */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: '#505368',
                        opacity: 0.9,
                        pointerEvents: 'none',
                        zIndex: 2,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: '#505368',
                        opacity: 0.9,
                        pointerEvents: 'none',
                        zIndex: 2,
                      }}
                    />

                    {/* (옵션) 내부 1초 눈금 — 필요 없으면 이 블록 삭제 */}
                    {Array.from({ length: tickCount - 1 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          left: (i + 1) * 100 - 1,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          background: 'rgba(255,255,255,0.06)',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      />
                    ))}
                  </div>
                );
              })}

            </div>
          </div>
        </div>
      ))}

      {/* 컨텍스트 메뉴 */}
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
              gap: '6px', // 아이콘과 텍스트 간격
            }}
          >
            <i className="fi fi-ss-trash-xmark"></i>
            Delete Audio
          </button>
        </div>

      )}
    </div>
  );

};

export default AudioTracks;
