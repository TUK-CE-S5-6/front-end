import React, { useState } from 'react';
import { useDispatch } from 'react-redux';

function VideoUpload() {
  const dispatch = useDispatch();
  const [videoFile, setVideoFile] = useState(null);
  const [sourceLanguage, setSourceLanguage] = useState('ko-KR');
  const [targetLanguage, setTargetLanguage] = useState('en-US');
  const [responseMessage, setResponseMessage] = useState('');
  const [videoData, setVideoData] = useState(null); // 서버에서 반환된 JSON 데이터 저장

  const handleFileChange = (e) => {
    setVideoFile(e.target.files[0]);
  };

  // JSON 데이터를 받아서 배경음과 TTS 트랙을 store에 저장하는 함수
  const processVideoData = (data) => {
    // 1. 배경음 처리: background_music이 있으면 새로운 오디오 그룹으로 추가
    if (data.background_music && data.background_music.file_path) {
      const bgGroup = {
        id: Date.now(), // 고유 id
        volume: data.background_music.volume || 100,
        tracks: [
          {
            id: Date.now() + 1, // 고유 트랙 id
            startTime: 0,
            duration: 0, // 배경음의 길이가 없을 경우 0으로 처리
            url: data.background_music.file_path, // 파일 경로를 url로 사용
            waveformImage: "", // 파형 이미지 정보가 없으면 빈 문자열
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

    // 화자별 그룹을 생성하여 store에 추가
    Object.keys(groupsBySpeaker).forEach((speaker) => {
      const ttsGroup = {
        id: Date.now() + Math.floor(Math.random() * 1000), // 고유 id 생성
        volume: 100,
        tracks: groupsBySpeaker[speaker].map((tts) => ({
          id: tts.tts_id, // TTS 고유 id 사용
          startTime: tts.start_time,
          duration: tts.duration,
          url: tts.file_path, // 파일 경로를 url로 사용
          waveformImage: "https://via.placeholder.com/100x40?text=TTS", // placeholder 이미지
          delayPx: 0,
          width: 100,
        })),
      };
      dispatch({
        type: 'ADD_AUDIO_GROUP',
        payload: ttsGroup,
      });
    });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!videoFile) {
      alert('파일을 선택하세요!');
      return;
    }

    const formData = new FormData();
    formData.append('file', videoFile);
    // 소스 및 타겟 언어 코드 추가
    formData.append('source_language', sourceLanguage);
    formData.append('target_language', targetLanguage);

    try {
      // 🎥 비디오 업로드 및 JSON 수신
      const uploadResponse = await fetch(
        'http://ec2-3-26-190-145.ap-southeast-2.compute.amazonaws.com:8000/upload-video',
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
      // 받아온 JSON 데이터를 store에 배경음과 TTS 트랙으로 저장
      processVideoData(uploadResult);
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
          {/* 비디오 정보 및 재생 */}
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
              src={`http://ec2-3-26-190-145.ap-southeast-2.compute.amazonaws.com:8000/videos/${videoData.video.file_name}`}
              type="video/mp4"
            />
            브라우저가 비디오 태그를 지원하지 않습니다.
          </video>

          {/* JSON 파일 전체 내용 출력 */}
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
