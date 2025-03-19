import React, { useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

// 오디오 버퍼를 기반으로 캔버스에 파형을 그리고 data URL을 반환하는 함수
const generateWaveformImage = (audioBuffer) => {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    const width = 300; // 캔버스 넓이 (원하는 크기로 조정 가능)
    const height = 100; // 캔버스 높이
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 배경 채우기
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    // 파형 그리기 (첫 번째 채널 데이터를 사용)
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
    const dataURL = canvas.toDataURL();
    resolve(dataURL);
  });
};

const AudioTracks = () => {
  const dispatch = useDispatch();
  const audioTracks = useSelector(state => state.audioTracks);
  const storeState = useSelector(state => state);
  const fileInputRef = useRef(null);
  const [uploadGroupId, setUploadGroupId] = useState(null);

  // 기본 placeholder 트랙 추가 함수
  const addAudioItem = (groupId) => {
    const newItem = {
      id: Date.now(),
      startTime: 0,
      duration: 5,
      url: "audio-placeholder.mp3",
      waveformImage: "https://via.placeholder.com/100x40?text=Wave",
      delayPx: 0,
      width: 100,
    };
    dispatch({
      type: 'ADD_AUDIO_TRACKS',
      payload: {
        trackGroupId: groupId,
        newTracks: [newItem]
      }
    });
  };

  // 오디오 아이템 드래그 이벤트 처리 (delayPx에 따라 1px 당 0.01초씩 startTime 업데이트)
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
        // 업로드한 오디오 데이터를 분석해 파형 이미지를 생성합니다.
        const waveformImage = await generateWaveformImage(audioBuffer);
        const newItem = {
          id: Date.now(),
          startTime: 0, // 기본 startTime (추후 delayPx에 따라 업데이트됨)
          duration,   // 실제 오디오 길이 (초)
          url: fileUrl,
          waveformImage, // 생성된 파형 이미지 data URL
          delayPx: 0,
          width: 100,
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
  };

  // 볼륨 변경 처리
  const handleVolumeChange = (groupId, newVolume) => {
    dispatch({
      type: 'CHANGE_AUDIO_VOLUME',
      payload: { groupId, volume: newVolume }
    });
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
      {/* 오디오 그룹 추가 버튼 제거됨 */}
      {audioTracks.map(group => (
        <div key={group.id} style={{ marginBottom: '0px' }}>
          <div style={{ display: 'flex', border: '1px solid #ccc', marginBottom: '0px' }}>
            {/* 좌측 메뉴 영역 */}
            <div style={{ width: '150px', backgroundColor: '#eee', padding: '10px' }}>
              <button onClick={() => handleUploadAudio(group.id)}>Upload Audio</button>
              <button onClick={() => handleDeleteGroup(group.id)}>Delete Group</button>
              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '12px', color: '#333' }}>Volume</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={group.volume}
                  onChange={(e) =>
                    handleVolumeChange(group.id, parseInt(e.target.value, 10))
                  }
                />
              </div>
              <button onClick={() => addAudioItem(group.id)} style={{ marginTop: '10px' }}>
                Add Audio Item
              </button>
            </div>
            {/* 우측 트랙 영역 */}
            <div
              style={{
                flexGrow: 1,
                backgroundColor: '#ddd',
                padding: '0px',
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
