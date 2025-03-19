// store.js
import { createStore } from 'redux';

const initialState = {
  audioTracks: [

  ],
  videoTracks: [

  ],
  combinedAudioUrl: null,
  outputUrl: null,
  globalTime: 0,
  timelineDuration: 20,
};

const reducer = (state = initialState, action) => {
  switch (action.type) {

    /* ============================
       AUDIO RELATED CODE
    ============================ */
    case 'ADD_AUDIO_TRACKS':
      // 지정된 오디오 그룹(trackGroupId)에 새 오디오 트랙(newTracks 배열)을 추가합니다.
      return {
        ...state,
        audioTracks: state.audioTracks.map(group =>
          group.id === action.payload.trackGroupId
            ? { ...group, tracks: [...group.tracks, ...action.payload.newTracks] }
            : group
        )
      };

    case 'ADD_AUDIO_GROUP':
      // 새로운 오디오 그룹을 생성하여 audioTracks 배열에 추가합니다.
      return {
        ...state,
        audioTracks: [...state.audioTracks, action.payload]
      };

    case 'UPDATE_AUDIO_TRACK_ITEM':
      // 지정된 오디오 그룹 내의 특정 트랙(trackId)의 delayPx 값을 업데이트합니다.
      return {
        ...state,
        audioTracks: state.audioTracks.map(group =>
          group.id === action.payload.groupId
            ? {
              ...group,
              tracks: group.tracks.map(track =>
                track.id === action.payload.trackId
                  ? { ...track, delayPx: action.payload.newDelayPx }
                  : track
              )
            }
            : group
        )
      };

    case 'CHANGE_AUDIO_VOLUME':
      // 지정된 오디오 그룹(groupId)의 volume 값을 업데이트합니다.
      return {
        ...state,
        audioTracks: state.audioTracks.map(group =>
          group.id === action.payload.groupId
            ? { ...group, volume: action.payload.volume }
            : group
        )
      };

    case 'DELETE_AUDIO_GROUP':
      // payload로 전달된 그룹 id에 해당하는 오디오 그룹을 삭제합니다.
      return {
        ...state,
        audioTracks: state.audioTracks.filter(group => group.id !== action.payload)
      };

    /* ============================
       VIDEO RELATED CODE
    ============================ */
    case 'ADD_VIDEO_TRACKS':
      // 지정된 비디오 그룹(trackGroupId)에 새 비디오 트랙(newTracks 배열)을 추가합니다.
      return {
        ...state,
        videoTracks: state.videoTracks.map(group =>
          group.id === action.payload.trackGroupId
            ? { ...group, tracks: [...group.tracks, ...action.payload.newTracks] }
            : group
        )
      };

    case 'ADD_VIDEO_GROUP':
      // 새로운 비디오 그룹을 생성하여 videoTracks 배열에 추가합니다.
      return {
        ...state,
        videoTracks: [...state.videoTracks, action.payload]
      };
    case 'UPDATE_VIDEO_TRACK_ITEM':
      return {
        ...state,
        videoTracks: state.videoTracks.map(group =>
          group.id === action.payload.groupId
            ? {
              ...group,
              tracks: group.tracks.map(track =>
                track.id === action.payload.trackId
                  ? {
                    ...track,
                    delayPx: action.payload.newDelayPx,
                    startTime: action.payload.newDelayPx * 0.01
                  }
                  : track
              )
            }
            : group
        )
      };


    /* ============================
       COMBINED / GLOBAL CODE
    ============================ */
    case 'SET_COMBINED_AUDIO_URL':
      // combinedAudioUrl 속성에 payload 값을 설정합니다.
      return { ...state, combinedAudioUrl: action.payload };

    default:
      return state;
  }
};

const store = createStore(reducer);

export default store;

