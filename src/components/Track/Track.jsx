import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AudioTrack from './AudioTrack';
import VideoTrack from './VideoTrack';
import TimeLine from './TimeLine';

const Track = () => {
  const dispatch = useDispatch();
  const audioTracks = useSelector((state) => state.audioTracks);
  const videoTracks = useSelector((state) => state.videoTracks);
  const nextAudioIndex = useSelector((state) => state.nextAudioTrackIndex);
  const nextVideoIndex = useSelector((state) => state.nextVideoTrackIndex);

  // 새 오디오 그룹 생성
  const addAudioTrack = () => {
    const newGroup = {
      id: Date.now(),
      volume: 100,
      tracks: [],
    };
    dispatch({ type: 'ADD_AUDIO_GROUP', payload: newGroup });
  };

  // 새 비디오 그룹 생성
  const addVideoTrack = () => {
    const newGroup = {
      id: Date.now(),
      volume: 100,
      tracks: [],
    };
    dispatch({ type: 'ADD_VIDEO_GROUP', payload: newGroup });
  };

  return (
    <div
      className="track-container"
      style={{
        width: '3000px',
        height: '500px',
        overflow: 'auto',
        border: '1px solid #ccc',
        backgroundColor: 'white',
      }}
    >
      <button onClick={addAudioTrack}>
        Add Audio Track {nextAudioIndex}
      </button>
      <button onClick={addVideoTrack}>
        Add Video Track {nextVideoIndex}
      </button>
      <TimeLine />
      <VideoTrack />
      <AudioTrack />
    </div>
  );
};

export default Track;