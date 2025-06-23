import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';


/**
 * 비디오 URL을 받아 16:9 (160×90) 크기의 썸네일을
 * intervalSec 간격으로 캡처한 이미지를 가로로 이어붙입니다.
 * 마지막 프레임은 캔버스 너비가 부족한 만큼 잘려서 표시됩니다.
 *
 * @param {string} videoUrl    비디오 파일의 URL
 * @param {number} intervalSec 캡처 간격(초), 기본 1.8
 * @returns {Promise<string>}  data:image/png;base64,… 형태의 이미지
 */
async function generateVideoCompositeThumbnail(videoUrl, intervalSec = 1.8) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const frameW = 160;
      const frameH = 90;
      const count = Math.ceil(duration / intervalSec);
      // 마지막 프레임의 가로 크기 계산
      const lastSec = duration - intervalSec * (count - 1);
      const lastWidth = frameW * (lastSec / intervalSec);

      // 캔버스 크기 설정
      const canvas = document.createElement('canvas');
      canvas.width = frameW * (count - 1) + lastWidth;
      canvas.height = frameH;
      const ctx = canvas.getContext('2d');

      let idx = 0;
      video.onseeked = () => {
        // (원본 전체) → (캔버스에 프레임 크기로 그리기)
        ctx.drawImage(
          video,
          0, 0, video.videoWidth, video.videoHeight,
          idx * frameW, 0,
          frameW, frameH
        );
        idx++;
        if (idx < count) {
          // 다음 시각으로 이동
          video.currentTime = Math.min(idx * intervalSec, duration);
        } else {
          // 모든 프레임 처리 완료
          resolve(canvas.toDataURL('image/png'));
        }
      };

      // 첫 프레임부터 시작
      video.currentTime = 0;
    };

    video.onerror = (e) => {
      reject(new Error('비디오 썸네일 생성 중 오류 발생: ' + e.message));
    };
  });
}

const BASE_URL = 'http://175.116.3.178:8000';


// 중복 생성 방지용 Sets
const processedProjects = new Set();
const processedGroups = new Set();

// 파형 이미지 생성 함수 (url -> dataURL)
async function fetchWaveform(url) {
  const token = localStorage.getItem('authToken');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`오디오 파일을 불러올 수 없습니다: ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const audioBuf = await ctx.decodeAudioData(arrayBuffer);
  ctx.close();
  const width = Math.floor(audioBuf.duration * 100);
  const height = 100;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, width, height);
  c.fillStyle = '#007bff';
  const data = audioBuf.getChannelData(0);
  const step = Math.floor(data.length / width);
  for (let i = 0; i < width; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += Math.abs(data[i * step + j]);
    const rawBar = (sum / step) * height * 3;
    const bar = Math.min(rawBar, height);
    c.fillRect(i, (height - bar) / 2, 1, bar);
  }
  return canvas.toDataURL();
}





function ProjectInfor() {
  const { projectId } = useParams();
  const dispatch = useDispatch();
  const [videosData, setVideosData] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (processedProjects.has(projectId)) return;
    const init = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(
          `${BASE_URL}/projects/${projectId}/videos/edit_data`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          const err = await res.json();
          setError(err.detail || '데이터를 불러오는 중 오류');
          return;
        }
        const { videos = [] } = await res.json();
        setVideosData(videos);

        for (const info of videos) {
          const vid = info.video.video_id;

          // 1) 비디오 트랙 그룹 생성 및 디폴트 속성 저장
          const videoGroupId = `video-${vid}`;
          if (!processedGroups.has(videoGroupId)) {
            dispatch({
              type: 'ADD_VIDEO_GROUP',
              payload: {
                id: videoGroupId,
                volume: 0,
                name: `Video Track 1`,
                tracks: []
              }
            });
            processedGroups.add(videoGroupId);
          }
          // 1-1) 비디오 트랙 추가
          const videoUrl = info.video.file_path.startsWith('http')
            ? info.video.file_path
            : `${BASE_URL}/${info.video.file_path.replace(/^\//, '')}`;
          const videoDuration = info.video.duration || 0;
          let thumb = '';
          try {
            thumb = await generateVideoCompositeThumbnail(videoUrl);
          } catch (e) {
            console.error('비디오 썸네일 생성 실패', e);
          }
          dispatch({
            type: 'ADD_VIDEO_TRACKS',
            payload: {
              trackGroupId: videoGroupId,
              newTracks: [{
                id: `video-track-${vid}`,
                startTime: 0,
                duration: videoDuration,
                url: videoUrl,
                thumbnail: thumb,
                delayPx: 0,
                width: Math.floor(videoDuration * 100),
              }]
            }
          });

          // 2) 배경음 오디오 그룹 및 트랙 저장
          if (info.background_music?.file_path) {
            const bgGroupId = `bg-${vid}`;
            if (!processedGroups.has(bgGroupId)) {
              dispatch({ type: 'ADD_AUDIO_GROUP', payload: { id: bgGroupId, volume: 100, tracks: [] } });
              processedGroups.add(bgGroupId);
            }
            const duration = info.background_music.duration || videoDuration;
            const trackWidth = Math.floor(duration * 100);
            const path = info.background_music.file_path.replace(/\\/g, '/').replace(/^\//, '');
            const audioUrl = info.background_music.file_path.startsWith('http')
              ? info.background_music.file_path
              : `${BASE_URL}/${path}`;
            // 배경음 파형 생성
            let bgImg = '';
            try { bgImg = await fetchWaveform(audioUrl); } catch (e) { console.error(e); }
            dispatch({
              type: 'ADD_AUDIO_TRACKS',
              payload: {
                trackGroupId: bgGroupId,
                newTracks: [{
                  id: `bg-track-${vid}`,
                  startTime: 0,
                  duration,
                  url: audioUrl,
                  waveformImage: bgImg,
                  delayPx: 0,
                  width: trackWidth,
                }]
              }
            });
          }

          // 3) TTS 화자별 그룹 및 트랙 저장
          const speakers = Array.from(new Set((info.tts_tracks || []).map(t => t.speaker)));
          for (const sp of speakers) {
            const spGroupId = `tts-${vid}-${sp}`;
            if (!processedGroups.has(spGroupId)) {
              dispatch({ type: 'ADD_AUDIO_GROUP', payload: { id: spGroupId, volume: 100, tracks: [] } });
              processedGroups.add(spGroupId);
            }
            const ttsList = info.tts_tracks.filter(t => t.speaker === sp);
            const tracks = await Promise.all(ttsList.map(async tts => {
              const p = tts.file_path.replace(/\\/g, '/').replace(/^\//, '');
              const u = tts.file_path.startsWith('http')
                ? tts.file_path
                : `${BASE_URL}/${p}`;
              let img = '';
              try { img = await fetchWaveform(u); } catch { };
              return {
                id: tts.tts_id,
                startTime: tts.start_time,
                duration: tts.duration,
                url: u,
                waveformImage: img,
                delayPx: Math.floor(tts.start_time * 100),
                width: Math.floor(tts.duration * 100),
                originalText: tts.original_text,     // ← 추가
                translatedText: tts.translated_text, // ← 추가
                voice:tts.voice
              };
            }));
            dispatch({ type: 'ADD_AUDIO_TRACKS', payload: { trackGroupId: spGroupId, newTracks: tracks } });
          }
        }
        processedProjects.add(projectId);
      } catch (e) {
        console.error(e);
        setError('네트워크 에러');
      }
    };
    init();
  }, [projectId, dispatch]);

  if (error) return <div>{error}</div>;
  if (!videosData.length) return <div>프로젝트에 영상이 없습니다.</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>프로젝트 영상 정보</h1>
      {videosData.map((videoInfo, idx) => (
        <div key={idx} style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '10px' }}>
          <h2>📌 비디오 정보</h2>
          <p><strong>파일명:</strong> {videoInfo.video.file_name}</p>
          <p><strong>경로:</strong> {videoInfo.video.file_path}</p>
          <p><strong>길이:</strong> {videoInfo.video.duration} 초</p>
          <video width="400" controls>
            <source src={`${BASE_URL}/videos/${videoInfo.video.file_name}`} type="video/mp4" />
          </video>

          <h3>배경음</h3>
          <p><strong>파일 경로:</strong> {videoInfo.background_music.file_path || '없음'}</p>
          <p><strong>볼륨:</strong> 100</p>

          <h3>TTS 트랙</h3>
          {videoInfo.tts_tracks.length > 0 ? (
            videoInfo.tts_tracks.map((tts) => (
              <div key={tts.tts_id} style={{ marginBottom: '10px' }}>
                <p><strong>파일 경로:</strong> {tts.file_path}</p>
                <p><strong>시작 시간:</strong> {tts.start_time}초</p>
                <p><strong>길이:</strong> {tts.duration}초</p>
                <p><strong>목소리:</strong> {tts.voice}</p>
                <p><strong>화자:</strong> {tts.speaker}</p>
                <p><strong>원본 텍스트:</strong> {tts.original_text}</p>
                <p><strong>번역 텍스트:</strong> {tts.translated_text}</p>
                <audio controls>
                  <source src={`${BASE_URL}/extracted_audio/${tts.file_path.replace(/^extracted_audio[\\/]/, '')}`} type="audio/mp3" />
                </audio>
              </div>
            ))
          ) : <p>TTS 트랙 없음</p>}
          <hr />
          <div style={{ marginTop: 30, padding: 10, background: '#f9f9f9' }}>
            <h2>📄 원본 JSON 데이터</h2>
            <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fff', padding: '10px', border: '1px solid #ddd', marginTop: '10px', maxHeight: '400px', overflow: 'auto' }}>
              {JSON.stringify(videosData, null, 2)}
            </pre>
          </div>

          <p><strong>데이터 조회 시간:</strong> {videoInfo.get_time.toFixed(2)}초</p>
        </div>
      ))}
    </div>
  );
}

export default ProjectInfor;