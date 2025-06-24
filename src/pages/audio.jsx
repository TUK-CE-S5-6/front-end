import React, { useState, useEffect } from 'react';
import { createAxiosInstance } from '../api';

// 일상에서 자주 쓰이는 6가지 사운드 프리셋 (이모티콘 추가)
const presets = [
  { name: '👏 박수', description: '사람들이 박수를 치는 경쾌한 박수 소리' },
  { name: '🌧️ 빗소리', description: '창문 밖에서 부슬부슬 내리는 빗소리' },
  { name: '🐦 새소리', description: '아침 숲 속에서 들리는 새들의 지저귐' },
  { name: '🌬️ 바람소리', description: '잎을 스치는 부드러운 바람 소리' },
  { name: '🚪 문 여닫기', description: '문이 열리고 닫힐 때 나는 소리' },
  { name: '📞 전화벨', description: '전화기가 울리는 짧고 명료한 벨 소리' },
];

function AudioGenerator({ loggedInUser }) {
  // 부모에서 안넘어올 때 로컬스토리지에서 직접 로드
  const [user, setUser] = useState(loggedInUser || null);
  const [text, setText] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      const token = localStorage.getItem('authToken');
      const userId = localStorage.getItem('userId');
      const username = localStorage.getItem('username');
      if (token && userId) {
        setUser({ token, userId: parseInt(userId), username });
      }
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('⚠️ 로그인 후 이용 가능합니다.');
      return;
    }
    setLoading(true);
    setError('');
    setAudioUrl(null);

    try {
      const api = createAxiosInstance(user.token);
      const formData = new FormData();
      formData.append('text', text);
      formData.append('user_id', String(user.userId));

      const response = await api.post(
        'http://localhost:8002/generate-sound-effect',
        formData
      );
      const data = response.data;
      const completeUrl = data.file_url.startsWith('http')
        ? data.file_url
        : `http://localhost:8002${data.file_url}`;
      setAudioUrl(completeUrl);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          '오디오 생성에 실패했습니다.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .audio-generator-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #333;
        }
        h2 {
          text-align: center;
          margin-bottom: 20px;
        }
        .presets-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .preset-button {
          padding: 10px;
          border: 1px solid #ccc;
          background-color: #f9f9f9;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.3s, border-color 0.3s;
        }
        .preset-button:hover {
          background-color: #e6f7ff;
          border-color: #91d5ff;
        }
        textarea {
          width: 100%;
          padding: 10px;
          font-size: 16px;
          border: 1px solid #ccc;
          border-radius: 4px;
          resize: vertical;
        }
        button[type="submit"] {
          margin-top: 10px;
          padding: 10px 20px;
          border: none;
          background-color: #1890ff;
          color: #fff;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        button[type="submit"]:hover {
          background-color: #40a9ff;
        }
        button[type="submit"]:disabled {
          background-color: #91d5ff;
          cursor: not-allowed;
        }
        .error {
          color: #ff4d4f;
          margin-top: 10px;
        }
        .audio-player {
          margin-top: 20px;
        }
      `}</style>

      <div className="audio-generator-container">
        <h2 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>
          🎶 효과음 생성하기
        </h2>

        {!user ? (
          <p className="error">⚠️ 로그인 후 이용 가능합니다.</p>
        ) : (
          <>
            <div className="presets-grid">
              {presets.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setText(p.description)}
                  className="preset-button"
                  style={{ color: '#000000', marginBottom: '0.5rem' }}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="효과음에 대한 설명을 입력하세요. 🎧"
                rows={4}
              />

              <button type="submit" disabled={loading}>
                {loading ? '생성 중...' : '✨ 효과음 생성'}
              </button>
            </form>

            {error && <p className="error">{error}</p>}
          </>
        )}
      </div>
    </>
  );
}

export default AudioGenerator;