// store.js
import { createStore } from 'redux';

const initialState = {
  audioTracks: [
    // 초기 오디오 그룹 배열 (없으면 빈 배열)
  ],
  videoTracks: [
    // 초기 비디오 그룹 배열 (없으면 빈 배열)
  ],
  combinedAudioUrl: null,
  outputUrl: null,
  nextAudioTrackIndex: 1,
  nextVideoTrackIndex: 1,
  globalTime: 0,
  timelineDuration: 23, // 초기에는 트랙이 없으므로 0+60 = 60
};

// helper 함수: 모든 그룹에서 (startTime + duration)의 최대값을 구하고 +60을 더함
const computeTimelineDuration = (state) => {
  let maxEnd = 0;
  // 오디오 트랙 그룹의 각 아이템에서 최대값 계산
  state.audioTracks.forEach(group => {
    group.tracks.forEach(track => {
      const endTime = track.startTime + track.duration;
      if (endTime > maxEnd) maxEnd = endTime;
    });
  });
  // 비디오 트랙 그룹의 각 아이템에서 최대값 계산
  state.videoTracks.forEach(group => {
    group.tracks.forEach(track => {
      const endTime = track.startTime + track.duration;
      if (endTime > maxEnd) maxEnd = endTime;
    });
  });
  return maxEnd + 23;
};

const reducer = (state = initialState, action) => {
  let newState;
  switch (action.type) {

    /* ============================
       AUDIO RELATED CODE
    ============================ */
    case 'ADD_AUDIO_TRACKS':
      newState = {
        ...state,
        audioTracks: state.audioTracks.map(group => {
          if (group.id !== action.payload.trackGroupId) return group;
          // 중복 ID 필터링
          const existingIds = new Set(group.tracks.map(t => t.id));
          const uniqueNew = action.payload.newTracks.filter(t => !existingIds.has(t.id));
          return { ...group, tracks: [...group.tracks, ...uniqueNew] };
        })
      };
      break;

    case 'ADD_AUDIO_GROUP':
      newState = {
        ...state,
        audioTracks: [
          ...state.audioTracks,
          {
            ...action.payload,
            name: `Audio Track ${state.nextAudioTrackIndex}`,
          }
        ],
        nextAudioTrackIndex: state.nextAudioTrackIndex + 1,
      };
      break;

    case 'UPDATE_AUDIO_TRACK_ITEM':
      newState = {
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
      break;

    case 'CHANGE_AUDIO_VOLUME':
      newState = {
        ...state,
        audioTracks: state.audioTracks.map(group =>
          group.id === action.payload.groupId
            ? { ...group, volume: action.payload.volume }
            : group
        )
      };
      break;

    case 'DELETE_AUDIO_GROUP':
      newState = {
        ...state,
        audioTracks: state.audioTracks.filter(group => group.id !== action.payload)
      };
      break;
    case 'DELETE_VIDEO_TRACK_ITEM':
      newState = {
        ...state,
        videoTracks: state.videoTracks.map(group =>
          group.id === action.payload.groupId
            ? {
              ...group,
              tracks: group.tracks.filter(
                track => track.id !== action.payload.trackId
              )
            }
            : group
        )
      };
      break;

    case 'DELETE_AUDIO_TRACK_ITEM':
      newState = {
        ...state,
        audioTracks: state.audioTracks.map(group =>
          group.id === action.payload.groupId
            ? {
              ...group,
              tracks: group.tracks.filter(
                track => track.id !== action.payload.trackId
              )
            }
            : group
        )
      };
      break;

    case 'UPDATE_AUDIO_GROUP_NAME':
      newState = {
        ...state,
        audioTracks: state.audioTracks.map(group =>
          group.id === action.payload.groupId
            ? { ...group, name: action.payload.name }
            : group
        )
      };
      break;

    case 'TOGGLE_AUDIO_GROUP_MUTE':
      newState = {
        ...state,
        audioTracks: state.audioTracks.map(group =>
          group.id === action.payload.groupId
            ? { ...group, muted: !group.muted }
            : group
        )
      };
      break;

    /* ============================
       VIDEO RELATED CODE
    ============================ */
    case 'ADD_VIDEO_TRACKS':
      newState = {
        ...state,
        videoTracks: state.videoTracks.map(group => {
          if (group.id !== action.payload.trackGroupId) return group;
          // 중복 ID 필터링
          const existingIds = new Set(group.tracks.map(t => t.id));
          const uniqueNew = action.payload.newTracks.filter(t => !existingIds.has(t.id));
          return { ...group, tracks: [...group.tracks, ...uniqueNew] };
        })
      };
      break;

    case 'ADD_VIDEO_GROUP':
      newState = {
        ...state,
        videoTracks: [
          ...state.videoTracks,
          {
            ...action.payload,
            name: `Video Track ${state.nextVideoTrackIndex}`,
          }
        ],
        nextVideoTrackIndex: state.nextVideoTrackIndex + 1,
      };
      break;


    case 'UPDATE_VIDEO_TRACK_ITEM':
      newState = {
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
      break;

    case 'CHANGE_VIDEO_VOLUME':
      newState = {
        ...state,
        videoTracks: state.videoTracks.map(group =>
          group.id === action.payload.groupId
            ? { ...group, volume: action.payload.volume }
            : group
        )
      };
      break;

    case 'UPDATE_VIDEO_GROUP_NAME':
      newState = {
        ...state,
        videoTracks: state.videoTracks.map(group =>
          group.id === action.payload.groupId
            ? { ...group, name: action.payload.name }
            : group
        )
      };
      break;

    case 'DELETE_VIDEO_GROUP':
      newState = {
        ...state,
        videoTracks: state.videoTracks.filter(group => group.id !== action.payload)
      };
      break;

    /* ============================
       COMBINED / GLOBAL CODE
    ============================ */
    case 'SET_COMBINED_AUDIO_URL':
      newState = { ...state, combinedAudioUrl: action.payload };
      break;


    case 'ADD_VIDEO_TRACK_URL': {
      const { trackGroupId, url, duration, waveformImage = '', thumbnailUrl = '' } = action.payload;
      const newTrack = {
        id: Date.now(),
        url,
        thumbnail: thumbnailUrl || '',  // store의 thumbnail 필드에 thumbnailUrl 매핑
        startTime: 0,
        duration: duration || 0,
        delayPx: 0,
        width: Math.ceil((duration || 0) * 100)
      };
      return {
        ...state,
        videoTracks: state.videoTracks.map(group =>
          group.id === trackGroupId
            ? { ...group, tracks: [...group.tracks, newTrack] }
            : group
        )
      };
    }
    case 'ADD_AUDIO_TRACK_URL': {
      const { trackGroupId, url, duration, waveformImage = '', thumbnailUrl = '' } = action.payload;

      const newTrack = {
        id: Date.now(),
        url,
        duration,
        startTime: 0,
        delayPx: 0,
        width: Math.ceil((duration || 0) * 100),
        waveformImage,
        thumbnailUrl,  // 이제 드랍 핸들러에서 보낸 thumbnailUrl이 여기에 저장됩니다
      };

      return {
        ...state,
        audioTracks: state.audioTracks.map(group => {
          if (group.id !== trackGroupId) return group;
          const ids = new Set(group.tracks.map(t => t.id));
          if (ids.has(newTrack.id)) return group;
          return { ...group, tracks: [...group.tracks, newTrack] };
        })
      };
    }


    case 'EDIT_TTS':
      newState = {
        ...state,
        audioTracks: state.audioTracks.map(group => ({
          ...group,
          tracks: group.tracks.map(track =>
            track.id === action.payload.id
              ? {
                  ...track,
                  duration: action.payload.duration,
                  url: action.payload.url,
                  translatedText: action.payload.translatedText,
                  originalText: action.payload.originalText
                }
              : track
          )
        }))
      };
      break;




    default:
      newState = state;
      break;
  }

  // timelineDuration을 모든 트랙의 최대 (startTime + duration) 값 +60 으로 업데이트
  return {
    ...newState,
    timelineDuration: computeTimelineDuration(newState)
  };
};

const store = createStore(reducer);

export default store;
