import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AudioTrack from './AudioTrack';
import VideoTrack from './VideoTrack';
import TimeLine from './TimeLine';
// 전역 카운터: 삭제되어도 계속 증가하도록 설정
let audioTrackCounter = 1;
let videoTrackCounter = 1;

const Track = () => {
  const dispatch = useDispatch();
  const audioTracks = useSelector(state => state.audioTracks);
  const videoTracks = useSelector(state => state.videoTracks);

  // "Add Audio Track" 버튼 클릭 시 새로운 오디오 그룹 생성
  const addAudioTrack = () => {
    const newGroup = {
      id: Date.now(), // 고유 id
      volume: 100,
      tracks: [],     // 초기에는 오디오 아이템 없음
      name: `Audio Track ${audioTrackCounter++}`
    };
    dispatch({
      type: 'ADD_AUDIO_GROUP',
      payload: newGroup,
    });
  };

  // "Add Video Track" 버튼 클릭 시 새로운 비디오 그룹 생성
  const addVideoTrack = () => {
    const newGroup = {
      id: Date.now(), // 고유 id
      volume: 100,
      tracks: [],     // 초기에는 비디오 아이템 없음
      name: `Video Track ${videoTrackCounter++}`
    };
    dispatch({
      type: 'ADD_VIDEO_GROUP',
      payload: newGroup,
    });
  };

  return (
    <div 
      className="track-container" 
      style={{ 
        width: '3000px', 
        height: '500px', 
        overflow: 'auto', 
        border: '1px solid #ccc' // 선택사항: 영역을 구분하기 위한 테두리
      }}
    >
      <button onClick={addAudioTrack}>Add Audio Track</button>
      <button onClick={addVideoTrack}>Add Video Track</button>
      <TimeLine />
      <VideoTrack />
      <AudioTrack />
    </div>
  );
};

export default Track;
