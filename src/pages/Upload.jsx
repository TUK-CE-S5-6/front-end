import React, { useState } from 'react';
import { useDispatch } from 'react-redux';

// AudioBuffer를 캔버스에 그려 파형 data URL을 반환하는 함수
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

// 주어진 URL에서 오디오 파일을 가져와 파형 이미지 생성 (절대 URL 필요)
const generateWaveformImageFromUrl = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`오디오 파일을 가져올 수 없습니다: ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContext();
  const audioBuffer = await new Promise((resolve, reject) => {
    audioCtx.decodeAudioData(arrayBuffer, resolve, reject);
  });
  const waveformImage = await generateWaveformImage(audioBuffer);
  audioCtx.close();
  return waveformImage;
};

function VideoUpload() {
  const dispatch = useDispatch();
  const [videoFile, setVideoFile] = useState(null);
  const [sourceLanguage, setSourceLanguage] = useState('ko-KR');
  const [targetLanguage, setTargetLanguage] = useState('en-US');
  const [responseMessage, setResponseMessage] = useState('');
  const [videoData, setVideoData] = useState(null);

  const handleFileChange = (e) => {
    setVideoFile(e.target.files[0]);
  };

  // JSON 데이터를 받아서 배경음과 TTS 트랙을 store에 저장하는 함수 (async 처리)
  const processVideoData = async (data) => {
    // 1. 배경음 처리
    if (data.background_music && data.background_music.file_path) {
      const bgGroup = {
        id: Date.now(), // 고유 id
        volume: data.background_music.volume || 100,
        tracks: [
          {
            id: Date.now() + 1, // 고유 트랙 id
            startTime: 0,
            duration: 0, // 배경음의 길이가 없으면 0
            url: data.background_music.file_path,
            waveformImage: "", // 배경음은 파형 이미지 필요 없을 수 있음
            delayPx: 0,
            width: 100,
          }
        ]
      };
      dispatch({
        type: 'ADD_AUDIO_GROUP',
        payload: bgGroup,
      });
    }

    // 2. TTS 트랙 처리: tts_tracks를 화자별로 그룹화
    const ttsTracks = data.tts_tracks || [];
    const groupsBySpeaker = {};
    ttsTracks.forEach((tts) => {
      const speaker = tts.speaker;
      if (!groupsBySpeaker[speaker]) {
        groupsBySpeaker[speaker] = [];
      }
      groupsBySpeaker[speaker].push(tts);
    });

    // 화자별 그룹 생성 및 waveformImage 생성
    const baseUrl = "http://ec2-3-107-168-194.ap-southeast-2.compute.amazonaws.com:8000/";
    for (const speaker in groupsBySpeaker) {
      const tracks = await Promise.all(groupsBySpeaker[speaker].map(async (tts) => {
        let waveformImage = "";
        try {
          const absoluteUrl = tts.file_path.startsWith("http")
            ? tts.file_path
            : baseUrl + tts.file_path;
          waveformImage = await generateWaveformImageFromUrl(absoluteUrl);
        } catch (error) {
          console.error("파형 이미지 생성 에러:", error);
        }
        return {
          id: tts.tts_id,
          startTime: tts.start_time,
          duration: tts.duration,
          url: tts.file_path,
          waveformImage, // 실제 오디오 파형에 기반한 이미지
          delayPx: Math.floor(tts.start_time * 100),
          width: 100,
        };
      }));
      const ttsGroup = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        volume: 100,
        tracks,
      };
      dispatch({
        type: 'ADD_AUDIO_GROUP',
        payload: ttsGroup,
      });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!videoFile) {
      alert('파일을 선택하세요!');
      return;
    }

    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('source_language', sourceLanguage);
    formData.append('target_language', targetLanguage);

    try {
      const uploadResponse = await fetch(
        'http://ec2-3-107-168-194.ap-southeast-2.compute.amazonaws.com:8000/upload-video',
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        setResponseMessage(`업로드 실패: ${errorData.detail}`);
        return;
      }

      const uploadResult = await uploadResponse.json();
      setResponseMessage('업로드 성공!');
      setVideoData(uploadResult);
      // 받아온 JSON 데이터를 비동기로 처리하여 store에 저장 (배경음, TTS 트랙)
      await processVideoData(uploadResult);
    } catch (error) {
      console.error('Error:', error);
      setResponseMessage('오류가 발생했습니다.');
    }
  };

  return (
    <div>
      <h1>동영상 업로드 및 JSON 데이터 보기</h1>
      <form onSubmit={handleUpload}>
        <div>
          <label>동영상 파일: </label>
          <input type="file" accept="video/*" onChange={handleFileChange} />
        </div>
        <div>
          <label>Source Language Code: </label>
          <input
            type="text"
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
          />
        </div>
        <div>
          <label>Target Language Code: </label>
          <input
            type="text"
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
          />
        </div>
        <button type="submit">업로드</button>
      </form>
      {responseMessage && <p>{responseMessage}</p>}

      {videoData && (
        <div>
          <h2>📌 비디오 정보</h2>
          <p>
            <strong>파일명:</strong> {videoData.video.file_name}
          </p>
          <p>
            <strong>파일 경로:</strong> {videoData.video.file_path}
          </p>
          <p>
            <strong>길이:</strong> {videoData.video.duration}초
          </p>
          <video controls width="600">
            <source
              src={`http://ec2-3-107-168-194.ap-southeast-2.compute.amazonaws.com:8000/videos/${videoData.video.file_name}`}
              type="video/mp4"
            />
            브라우저가 비디오 태그를 지원하지 않습니다.
          </video>

          <div style={{ marginTop: '40px', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9' }}>
            <h2>JSON 데이터</h2>
            <pre style={{ fontSize: '12px' }}>
              {JSON.stringify(videoData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoUpload;
