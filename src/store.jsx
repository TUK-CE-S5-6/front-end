// store.js
import { createStore } from 'redux';

const initialState = {
  audioTracks: [
    // ...
  ],
  videoTracks: [
    // ...
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
      return {
        ...state,
        audioTracks: state.audioTracks.map(group =>
          group.id === action.payload.trackGroupId
            ? { ...group, tracks: [...group.tracks, ...action.payload.newTracks] }
            : group
        )
      };

    case 'ADD_AUDIO_GROUP':
      return {
        ...state,
        audioTracks: [...state.audioTracks, action.payload]
      };

    case 'UPDATE_AUDIO_TRACK_ITEM':
      return {
        ...state,
        audioTracks: state.audioTracks.map(group =>
          group.id === action.payload.groupId
            ? {
              ...group,
              tracks: group.tracks.map(track =>
                track.id === action.payload.trackId
                  ? {
                    ...track,
                    delayPx: action.payload.newDelayPx,
                    startTime: Number((action.payload.newDelayPx * 0.01).toFixed(2))
                  }
                  : track
              )
            }
            : group
        )
      };

    case 'CHANGE_AUDIO_VOLUME':
      return {
        ...state,
        audioTracks: state.audioTracks.map(group =>
          group.id === action.payload.groupId
            ? { ...group, volume: action.payload.volume }
            : group
        )
      };

    case 'DELETE_AUDIO_GROUP':
      return {
        ...state,
        audioTracks: state.audioTracks.filter(group => group.id !== action.payload)
      };

    case 'UPDATE_AUDIO_GROUP_NAME':
      return {
        ...state,
        audioTracks: state.audioTracks.map(group =>
          group.id === action.payload.groupId
            ? { ...group, name: action.payload.name }
            : group
        )
      };

    case 'TOGGLE_AUDIO_GROUP_MUTE':
      return {
        ...state,
        audioTracks: state.audioTracks.map(group =>
          group.id === action.payload.groupId
            ? { ...group, muted: !group.muted }
            : group
        )
      };

    /* ============================
       VIDEO RELATED CODE
    ============================ */
    case 'ADD_VIDEO_TRACKS':
      return {
        ...state,
        videoTracks: state.videoTracks.map(group =>
          group.id === action.payload.trackGroupId
            ? { ...group, tracks: [...group.tracks, ...action.payload.newTracks] }
            : group
        )
      };

    case 'ADD_VIDEO_GROUP':
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
                    startTime: Number((action.payload.newDelayPx * 0.01).toFixed(2))
                  }
                  : track
              )
            }
            : group
        )
      };

    case 'CHANGE_VIDEO_VOLUME':
      return {
        ...state,
        videoTracks: state.videoTracks.map(group =>
          group.id === action.payload.groupId
            ? { ...group, volume: action.payload.volume }
            : group
        )
      };

    // 비디오 그룹 이름 업데이트 (오디오와 유사)
    case 'UPDATE_VIDEO_GROUP_NAME':
      return {
        ...state,
        videoTracks: state.videoTracks.map(group =>
          group.id === action.payload.groupId
            ? { ...group, name: action.payload.name }
            : group
        )
      };

    // 비디오 그룹 삭제
    case 'DELETE_VIDEO_GROUP':
      return {
        ...state,
        videoTracks: state.videoTracks.filter(group => group.id !== action.payload)
      };

    /* ============================
       COMBINED / GLOBAL CODE
    ============================ */
    case 'SET_COMBINED_AUDIO_URL':
      return { ...state, combinedAudioUrl: action.payload };

    default:
      return state;
  }
};

const store = createStore(reducer);

export default store;
