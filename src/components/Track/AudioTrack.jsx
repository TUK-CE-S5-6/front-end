// src/components/Track/AudioTracks.jsx
import React, { useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

// 파형 이미지 생성 함수 (기존 그대로)
const generateWaveformImage = (audioBuffer, width, height) => {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#007bff";
    const rawData = audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.floor(rawData.length / width);
    for (let i = 0; i < width; i++) {
      let sum = 0;
      for (let j = 0; j < samplesPerPixel; j++) {
        sum += Math.abs(rawData[i * samplesPerPixel + j]);
      }
      const avg = sum / samplesPerPixel;
      const barHeight = avg * height;
      ctx.fillRect(i, (height - barHeight) / 2, 1, barHeight);
    }
    resolve(canvas.toDataURL());
  });
};

const AudioTracks = () => {
  const dispatch = useDispatch();
  const audioTracks = useSelector(state => state.audioTracks);
  const timelineDuration = useSelector(state => state.timelineDuration);
  const storeState = useSelector(state => state); // <-- 전체 스토어 상태 가져오기

  const fileInputRef = useRef(null);
  const containerRefs = useRef({});

  const [uploadGroupId, setUploadGroupId] = useState(null);
  const [activeMenuGroup, setActiveMenuGroup] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [draggingItem, setDraggingItem] = useState(null);
  const [localVolume, setLocalVolume] = useState({});

    // 드롭된 JSON (url, duration, waveformImage)을 받아서 Redux에 추가
    const handleDropAudio = (e, groupId) => {
      e.preventDefault();
      const json = e.dataTransfer.getData('application/json');
      if (!json) return;
      let data;
      try {
        data = JSON.parse(json);
      } catch {
        return;
      }
      const { url, duration, waveformImage = '' } = data;
      dispatch({
        type: 'ADD_AUDIO_TRACK_URL',
        payload: {
          trackGroupId: groupId,
          url,
          duration,
          waveformImage
        }
      });
      alert(`"${url}" 을(를) 오디오 트랙 ${groupId}에 추가했습니다. (길이: ${duration.toFixed(2)}초)`);
    };

  // 오디오 아이템 드래그 위치 조정
  const handleItemMouseDown = (e, groupId, itemId, currentDelayPx = 0, itemWidth = 100) => {
    const startX = e.clientX;
    let finalDelayPx = currentDelayPx;
    setDraggingItem({ groupId, trackId: itemId, newDelayPx: currentDelayPx });

    const onMouseMove = moveEvent => {
      const delta = moveEvent.clientX - startX;
      let newLeft = currentDelayPx + delta;
      const container = containerRefs.current[groupId];
      if (container) {
        const cw = container.offsetWidth;
        newLeft = Math.max(0, Math.min(newLeft, cw - itemWidth));
      }
      finalDelayPx = newLeft;
      setDraggingItem(prev => ({ ...prev, newDelayPx: newLeft }));
    };

    const onMouseUp = () => {
      const finalStartTime = Number((finalDelayPx * 0.01).toFixed(2));
      dispatch({
        type: 'UPDATE_AUDIO_TRACK_ITEM',
        payload: { groupId, trackId: itemId, newDelayPx: finalDelayPx, newStartTime: finalStartTime }
      });
      setDraggingItem(null);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
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

  // 파일 선택 후 처리
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
        const waveformImage = await generateWaveformImage(audioBuffer, width, 100);
        const newItem = {
          id: Date.now(),
          startTime: 0,
          duration,
          url: fileUrl,
          waveformImage,
          delayPx: 0,
          width,
        };
        dispatch({
          type: 'ADD_AUDIO_TRACKS',
          payload: { trackGroupId: uploadGroupId, newTracks: [newItem] }
        });
        tempCtx.close();
      } catch (err) {
        console.error("Error processing audio file:", err);
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
    setLocalVolume(prev => ({ ...prev, [groupId]: value }));

  const handleVolumeMouseUp = (groupId) => {
    const vol = localVolume[groupId];
    if (vol != null) {
      dispatch({ type: 'CHANGE_AUDIO_VOLUME', payload: { groupId, volume: vol } });
    }
  };

  const toggleVolume = (group) => {
    const newVol = group.volume > 0 ? 0 : 100;
    setLocalVolume(prev => ({ ...prev, [group.id]: newVol }));
    dispatch({ type: 'CHANGE_AUDIO_VOLUME', payload: { groupId: group.id, volume: newVol } });
  };

  const startEditName = (group) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const finishEditName = (groupId) => {
    dispatch({ type: 'UPDATE_AUDIO_GROUP_NAME', payload: { groupId, name: editingName } });
    setEditingGroupId(null);
    setEditingName('');
  };

  return (
    <div>
      <input
        type="file"
        accept="audio/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {audioTracks.map(group => (
        <div key={group.id} style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', border: '1px solid #ccc' }}>
            {/* 좌측 메뉴 영역 */}
            <div style={{ width: 210, backgroundColor: '#eee', overflow: 'visible' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {editingGroupId === group.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={() => finishEditName(group.id)}
                    onKeyDown={e => e.key === 'Enter' && finishEditName(group.id)}
                    autoFocus
                    style={{ fontSize: 12, color: '#333' }}
                  />
                ) : (
                  <span
                    style={{ fontSize: 12, color: '#333', cursor: 'pointer' }}
                    onClick={() => startEditName(group)}
                  >
                    {group.name}
                  </span>
                )}
                <div style={{ position: 'relative' }}>
                  <button onClick={() =>
                    setActiveMenuGroup(activeMenuGroup === group.id ? null : group.id)
                  }>:</button>
                  {activeMenuGroup === group.id && (
                    <div style={{
                      position: 'absolute', top: 0, left: '100%', marginLeft: 10,
                      backgroundColor: '#fff', border: '1px solid #ccc', zIndex: 1
                    }}>
                      <button onClick={() => handleUploadAudio(group.id)}>Upload Audio</button>
                      <button onClick={() => handleDeleteGroup(group.id)}>Delete Group</button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', height: 40, width: 200 }}>
                <button
                  onClick={() => toggleVolume(group)}
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
                  onChange={e => handleVolumeChange(group.id, parseInt(e.target.value, 10))}
                  onMouseUp={() => handleVolumeMouseUp(group.id)}
                  onTouchEnd={() => handleVolumeMouseUp(group.id)}
                  style={{ width: 'calc(100% - 45px)' }}
                />
              </div>
            </div>

            {/* 우측 트랙 + DropZone */}
            <div
              ref={el => { containerRefs.current[group.id] = el }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDropAudio(e, group.id)}
              style={{
                flexGrow: 1,
                backgroundColor: '#ddd',
                position: 'relative',
                height: '100px',
                // ↓ 여기가 핵심: timelineDuration * 100px 만큼 너비를 고정
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
                      handleItemMouseDown(e, group.id, item.id, item.delayPx, item.width || 150)
                    }
                  >
                    <img
                      src={item.waveformImage}
                      alt="audio waveform"
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

      {/* 맨 아래 디버깅용 Store State */}
      <div style={{
        marginTop: '40px',
        border: '1px solid #000',
        backgroundColor: '#f9f9f9',
        padding: '10px'
      }}>
        <h3>Store State</h3>
        <pre style={{ fontSize: '12px' }}>
          {JSON.stringify(storeState, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default AudioTracks;
