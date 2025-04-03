import React, { useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

// 수정된 파형 이미지 생성 함수: width와 height를 매개변수로 받음
const generateWaveformImage = (audioBuffer, width, height) => {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 배경 채우기
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    // 파형 그리기 (첫 번째 채널 데이터 사용)
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
  const storeState = useSelector(state => state);
  const fileInputRef = useRef(null);
  const [uploadGroupId, setUploadGroupId] = useState(null);
  const [activeMenuGroup, setActiveMenuGroup] = useState(null);
  // 이름 편집을 위한 상태
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // 기본 placeholder 트랙 추가 함수
  const addAudioItem = (groupId) => {
    const duration = 5; // placeholder로 5초
    const newItem = {
      id: Date.now(),
      startTime: 0,
      duration,
      url: "audio-placeholder.mp3",
      waveformImage: "https://via.placeholder.com/100x40?text=Wave",
      delayPx: 0,
      width: Math.floor(duration * 100),
    };
    dispatch({
      type: 'ADD_AUDIO_TRACKS',
      payload: {
        trackGroupId: groupId,
        newTracks: [newItem]
      }
    });
  };

  // 오디오 아이템 드래그 이벤트 처리
  const handleItemMouseDown = (e, groupId, itemId, currentDelayPx = 0) => {
    const startX = e.clientX;
    const initialLeft = currentDelayPx;

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const newLeft = initialLeft + delta;
      const newStartTime = newLeft * 0.01;
      dispatch({
        type: 'UPDATE_AUDIO_TRACK_ITEM',
        payload: { groupId, trackId: itemId, newDelayPx: newLeft, newStartTime }
      });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Upload Audio 버튼 클릭 시 파일 선택 창 열기
  const handleUploadAudio = (groupId) => {
    setUploadGroupId(groupId);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
      fileInputRef.current.click();
    }
    setActiveMenuGroup(null);
  };

  // 파일 선택 후, 오디오 파일을 읽어 파형 이미지 생성 및 트랙 추가
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && uploadGroupId) {
      const fileUrl = URL.createObjectURL(file);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const tempAudioCtx = new AudioContext();
        const audioBuffer = await new Promise((resolve, reject) => {
          tempAudioCtx.decodeAudioData(arrayBuffer, resolve, reject);
        });
        const duration = audioBuffer.duration;
        const width = Math.floor(duration * 100);
        const waveformImage = await generateWaveformImage(audioBuffer, width, 40);
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
          payload: {
            trackGroupId: uploadGroupId,
            newTracks: [newItem]
          }
        });
        setUploadGroupId(null);
        tempAudioCtx.close();
      } catch (error) {
        console.error("Error processing audio file:", error);
      }
    }
  };

  // 그룹 삭제
  const handleDeleteGroup = (groupId) => {
    dispatch({
      type: 'DELETE_AUDIO_GROUP',
      payload: groupId,
    });
    setActiveMenuGroup(null);
  };

  // 볼륨 슬라이더 변경 처리
  const handleVolumeChange = (groupId, newVolume) => {
    dispatch({
      type: 'CHANGE_AUDIO_VOLUME',
      payload: { groupId, volume: newVolume }
    });
  };

  // 스피커 버튼 클릭 시, 현재 볼륨이 0이면 100으로, 0이 아니면 0으로 토글
  const handleVolumeToggle = (group) => {
    const newVolume = group.volume > 0 ? 0 : 100;
    dispatch({
      type: 'CHANGE_AUDIO_VOLUME',
      payload: { groupId: group.id, volume: newVolume }
    });
  };

  // 그룹 이름 편집 시작
  const startEditingName = (group) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  // 그룹 이름 편집 완료 (엔터 또는 블러 시)
  const finishEditingName = (groupId) => {
    dispatch({
      type: 'UPDATE_AUDIO_GROUP_NAME',
      payload: { groupId, name: editingName }
    });
    setEditingGroupId(null);
    setEditingName('');
  };

  return (
    
      <div>
        {/* 숨겨진 파일 input */}
        <input 
          type="file" 
          accept="audio/*" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange} 
        />
        {audioTracks.map(group => (
          <div key={group.id} style={{ marginBottom: '0px' }}>
            <div style={{ display: 'flex', border: '1px solid #ccc', marginBottom: '0px' }}>
              {/* 좌측 메뉴 영역: width 210px (150px + 60px), overflow visible */}
              <div style={{ width: '210px', backgroundColor: '#eee', padding: '10px', overflow: 'visible' }}>
                {/* 그룹 이름과 메뉴 버튼 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {editingGroupId === group.id ? (
                    <input 
                      type="text" 
                      value={editingName} 
                      onChange={(e) => setEditingName(e.target.value)} 
                      onBlur={() => finishEditingName(group.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') finishEditingName(group.id);
                      }}
                      autoFocus
                      style={{ fontSize: '12px' }}
                    />
                  ) : (
                    <span 
                      style={{ fontSize: '12px', color: '#333', cursor: 'pointer' }}
                      onClick={() => startEditingName(group)}
                    >
                      {group.name}
                    </span>
                  )}
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setActiveMenuGroup(activeMenuGroup === group.id ? null : group.id)}>
                      :
                    </button>
                    {activeMenuGroup === group.id && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: '100%',
                        marginLeft: '10px',
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        padding: '10px',
                        zIndex: 1
                      }}>
                        <button onClick={() => handleUploadAudio(group.id)}>Upload Audio</button>
                        <button onClick={() => handleDeleteGroup(group.id)}>Delete Group</button>
                        
                      </div>
                    )}
                  </div>
                </div>
                {/* 볼륨 슬라이더와 스피커 버튼 (가로 400px 고정) */}
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', height: '40px', width: '200px' }}>
                  <button 
                    onClick={() => handleVolumeToggle(group)}
                    style={{ width: '40px', height: '40px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', marginRight: '5px' }}
                  >
                    {group.volume === 0 ? '🔇' : '🔊'}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={group.volume}
                    onChange={(e) =>
                      handleVolumeChange(group.id, parseInt(e.target.value, 10))
                    }
                    style={{ width: 'calc(100% - 45px)' }}
                  />
                </div>
              </div>
              {/* 우측 트랙 영역 */}
              <div
                style={{
                  flexGrow: 1,
                  backgroundColor: '#ddd',
                  padding: '0px',
                  paddingLeft: '60px', // 왼쪽 영역이 늘어난 만큼 내부 콘텐츠를 오른쪽으로 이동
                  position: 'relative',
                  height: '100px'
                }}
              >
                {group.tracks.map(item => (
                  <div
                    key={item.id}
                    style={{
                      position: 'absolute',
                      left: `${item.delayPx || 0}px`,
                      width: `${item.width || 100}px`,
                      height: '40px',
                      cursor: 'grab'
                    }}
                    onMouseDown={(e) =>
                      handleItemMouseDown(e, group.id, item.id, item.delayPx)
                    }
                  >
                    <img
                      src={item.waveformImage}
                      alt="audio waveform"
                      style={{ width: '100%', height: '100%' }}
                    />
                    <div style={{ fontSize: '10px', color: '#000' }}>
                      <p>Start: {(item.delayPx * 0.01).toFixed(2)}s</p>
                      <p>Duration: {item.duration ? item.duration.toFixed(2) : 'N/A'}s</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {/* 전체 store 상태 출력 */}
        <div style={{ marginTop: '40px', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9' }}>
          <h3>Store State</h3>
          <pre style={{ fontSize: '12px' }}>
            {JSON.stringify(storeState, null, 2)}
          </pre>
        </div>
      </div>
    );
    
};

export default AudioTracks;
