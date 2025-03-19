import React, { useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

const VideoTracks = () => {
  const dispatch = useDispatch();
  const videoTracks = useSelector(state => state.videoTracks);
  const [uploadVideoGroupId, setUploadVideoGroupId] = useState(null);
  const videoFileInputRef = useRef(null);

  // 새로운 비디오 그룹 추가 (필요 시 사용)
  const addVideoGroup = () => {
    const newGroup = {
      id: Date.now(), // 고유 id
      volume: 100,
      tracks: []      // 초기에는 비디오 아이템 없음
    };
    dispatch({
      type: 'ADD_VIDEO_GROUP',
      payload: newGroup
    });
  };

  // placeholder 비디오 아이템 추가 함수
  const addVideoItem = (groupId) => {
    const newItem = {
      id: Date.now(),
      // delayPx 1당 0.01초 계산 (초기 delayPx는 0이므로 startTime은 0)
      startTime: 0 * 0.01,
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

  // 드래그 이벤트: 비디오 아이템의 위치(delayPx) 업데이트 및 startTime 계산
  const handleItemMouseDown = (e, groupId, itemId, currentDelayPx = 0) => {
    const startX = e.clientX;
    const initialLeft = currentDelayPx;

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const newLeft = initialLeft + delta;
      const newStartTime = newLeft * 0.01; // 1px 당 0.01초 계산
      dispatch({
        type: 'UPDATE_VIDEO_TRACK_ITEM',
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

  // 파일 선택 창 열기: Upload Video 버튼 클릭 시 호출
  const handleUploadVideo = (groupId) => {
    setUploadVideoGroupId(groupId);
    if (videoFileInputRef.current) {
      videoFileInputRef.current.value = null;
      videoFileInputRef.current.click();
    }
  };

  // 파일 선택 후, 비디오 파일의 URL을 반영하고 썸네일을 생성하여 비디오 아이템 추가
  const handleVideoFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && uploadVideoGroupId) {
      const fileUrl = URL.createObjectURL(file);
      try {
        const video = document.createElement("video");
        video.src = fileUrl;
        video.muted = true;
        video.playsInline = true;
        // 메타데이터 로드하여 duration 및 비디오 크기 확인
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = () => {
            resolve();
          };
          video.onerror = reject;
        });
        // 썸네일 캡처: 1초 후 프레임(또는 비디오 길이에 따라 0초)을 선택
        const captureTime = video.duration > 1 ? 1 : 0;
        video.currentTime = captureTime;
        await new Promise((resolve, reject) => {
          video.onseeked = () => {
            resolve();
          };
          video.onerror = reject;
        });
        // 캔버스에 그려 썸네일 생성
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL("image/png");

        const newItem = {
          id: Date.now(),
          // delayPx 1당 0.01초 계산 (초기 delayPx는 0이므로 startTime은 0)
          startTime: 0 * 0.01,
          duration: video.duration,
          url: fileUrl,
          thumbnail, // 생성된 썸네일 이미지 data URL
          delayPx: 0,
          width: 20,
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

  // 추가 동작: 그룹 삭제, 볼륨 변경 등
  const handleDeleteGroup = (groupId) => {
    console.log("Delete group", groupId);
  };

  const handleVolumeChange = (groupId, newVolume) => {
    dispatch({
      type: 'CHANGE_VIDEO_VOLUME',
      payload: { groupId, volume: newVolume }
    });
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
        <div key={group.id}>
          <div style={{ display: 'flex', border: '1px solid #ccc' }}>
            {/* 좌측 메뉴 영역 */}
            <div style={{ width: '150px', backgroundColor: '#eee', padding: '10px' }}>
              <button onClick={() => handleUploadVideo(group.id)}>Upload Video</button>
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
              <button onClick={() => addVideoItem(group.id)} style={{ marginTop: '10px' }}>
                Add Video Item
              </button>
            </div>
            {/* 우측 트랙 영역 */}
            <div
              style={{
                flexGrow: 1,
                backgroundColor: '#ddd',
                padding: '10px',
                position: 'relative',
                height: '120px'
              }}
            >
              {group.tracks.map(item => (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    left: `${item.delayPx || 0}px`,
                    width: `${item.width || 150}px`,
                    cursor: 'grab'
                  }}
                  onMouseDown={(e) =>
                    handleItemMouseDown(e, group.id, item.id, item.delayPx)
                  }
                >
                  <img
                    src={item.thumbnail}
                    alt="video thumbnail"
                    style={{ width: '100%', height: 'auto' }}
                  />
                  <div style={{ fontSize: '10px', color: '#000' }}>
                    <p>Start: {(item.delayPx * 0.01).toFixed(2)}s</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default VideoTracks;
