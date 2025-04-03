import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AudioTrack from './AudioTrack';
import VideoTrack from './VideoTrack';

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
    <div className="track-container">
      <button onClick={addAudioTrack}>Add Audio Track</button>
      <button onClick={addVideoTrack}>Add Video Track</button>
      <VideoTrack />
      <AudioTrack />
    </div>
  );
};

export default Track;
