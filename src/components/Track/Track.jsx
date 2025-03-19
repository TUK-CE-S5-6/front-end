import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AudioTrack from './AudioTrack';
import VideoTrack from './VideoTrack';

const Track = () => {
  const dispatch = useDispatch();
  const audioTracks = useSelector(state => state.audioTracks);

  // "Add Audio Track" 버튼 클릭 시 새로운 오디오 그룹 생성 (store의 ADD_AUDIO_GROUP 액션 사용)
  const addAudioTrack = () => {
    const newGroup = {
      id: Date.now(), // 고유 id
      volume: 100,
      tracks: []     // 초기에는 오디오 아이템 없음
    };
    dispatch({
      type: 'ADD_AUDIO_GROUP',
      payload: newGroup,
    });
  };
  const addVideoTrack = () => {
    const newGroup = {
      id: Date.now(), // 고유 id
      volume: 100,
      tracks: []     // 초기에는 비디오 아이템 없음
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
