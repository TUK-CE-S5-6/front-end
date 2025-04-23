import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

function FileDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const filename = searchParams.get('filename');
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDetails() {
      if (!filename) {
        setError('파일명이 제공되지 않았습니다.');
        return;
      }
      try {
        const response = await axios.get(
          `http://175.116.3.178:8000/file-details?filename=${encodeURIComponent(
            filename
          )}`
        );
        setDetails(response.data);
      } catch (err) {
        setError('파일 세부 정보를 불러오는 데 실패했습니다.');
      }
    }
    fetchDetails();
  }, [filename]);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <button onClick={() => navigate(-1)}>뒤로가기</button>
      <h1>파일 세부 정보: {filename}</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {details ? (
        <div>
          <h2>Uploaded Video</h2>
          <video controls width="600">
            <source
              src={`http://175.116.3.178:8000/videos/${details.video.file_name}`}
              type="video/mp4"
            />
            브라우저가 비디오 태그를 지원하지 않습니다.
          </video>
          <h2>Extracted Audio</h2>
          <audio controls>
            <source
              src={`http://175.116.3.178:8000/extracted_audio/${details.extracted_audio.file_name}`}
              type="audio/mp3"
            />
          </audio>
          <h2>Spleeter Files</h2>
          <div>
            {details.spleeter && details.spleeter.vocal ? (
              <div>
                <h3>Vocal</h3>
                <audio controls>
                  <source src={`${details.spleeter.vocal}`} type="audio/wav" />
                </audio>
              </div>
            ) : (
              <p>Vocal 파일 없음</p>
            )}
            {details.spleeter && details.spleeter.accompaniment ? (
              <div>
                <h3>Accompaniment</h3>
                <audio controls>
                  <source
                    src={`${details.spleeter.accompaniment}`}
                    type="audio/wav"
                  />
                </audio>
              </div>
            ) : (
              <p>Accompaniment 파일 없음</p>
            )}
          </div>
          <h2>TTS Tracks</h2>
          {details.tts_tracks && details.tts_tracks.length > 0 ? (
            <ul>
              {details.tts_tracks.map((tts) => (
                <li key={tts.tts_id}>
                  <p>
                    <strong>목소리:</strong> {tts.voice}
                  </p>
                  <p>
                    <strong>시작 시간:</strong> {tts.start_time}초
                  </p>
                  <p>
                    <strong>길이:</strong> {tts.duration}초
                  </p>
                  <p>
                    <strong>번역 텍스트:</strong> {tts.translated_text}
                  </p>
                  <p>
                    <strong>원본 텍스트:</strong> {tts.original_text}
                  </p>
                  <p>
                    <strong>화자:</strong> {tts.speaker}
                  </p>
                  <audio controls>
                    <source src={`${tts.file_url}`} type="audio/mp3" />
                  </audio>
                </li>
              ))}
            </ul>
          ) : (
            <p>TTS 트랙이 없습니다.</p>
          )}
        </div>
      ) : (
        <p>세부 정보를 불러오는 중...</p>
      )}
    </div>
  );
}

export default FileDetails;
