import React, { useState, useEffect } from 'react';
import { createAxiosInstance } from '../api';

// 프리셋 데이터
const presets = [
  {
    name: '👏 박수',
    description: '사람들이 박수를 치는 경쾌한 박수 소리',
    thumbnail: '/thumbnails/clap.png',
    icon: <i className="fi fi-sr-hands-clapping" style={{ fontSize: 20 }}></i>,
  },
  {
    name: '🌧️ 빗소리',
    description: '창문 밖에서 부슬부슬 내리는 빗소리',
    thumbnail: '/thumbnails/rain.png',
    icon: <i className="fi fi-rs-cloud-showers-heavy" style={{ fontSize: 20 }}></i>,
  },
  {
    name: '🐦 새소리',
    description: '아침 숲 속에서 들리는 새들의 지저귐',
    thumbnail: '/thumbnails/birds.png',
    icon: <img src="/image.png" alt="새소리" style={{ width: 40, height: 40, display: 'block' }} />,
  },
  {
    name: '🌬️ 바람소리',
    description: '잎을 스치는 부드러운 바람 소리',
    thumbnail: '/thumbnails/wind.png',
    icon: <i className="fi fi-bs-wind" style={{ fontSize: 20 }}></i>,
  },
  {
    name: '🚪 문 여닫기',
    description: '문이 열리고 닫힐 때 나는 소리',
    thumbnail: '/thumbnails/door.png',
    icon: <i className="fi fi-ss-door-open" style={{ fontSize: 20 }}></i>,
  },
  {
    name: '📞 전화벨',
    description: '전화기가 울리는 짧고 명료한 벨 소리',
    thumbnail: '/thumbnails/phone.png',
    icon: <i className="fi fi-sr-phone-flip" style={{ fontSize: 20 }}></i>,
  },
];

function AudioGenerator({ loggedInUser }) {
  const [user, setUser] = useState(loggedInUser || null);
  const [text, setText] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [presetName, setPresetName] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);

  // 버튼 호버용
  const [hoverIndex, setHoverIndex] = useState(-1);

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

  const handlePresetClick = (preset) => {
    setText(preset.description);
    setPresetName(preset.name);
    setThumbnailUrl(preset.thumbnail);
  };

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
      if (presetName) formData.append('preset_name', presetName);
      if (thumbnailUrl) formData.append('thumbnail_url', thumbnailUrl);
      formData.append('duration_seconds', '10');
      formData.append('prompt_influence', '0.3');

      const response = await api.post('http://175.116.3.178:8002/generate-sound-effect', formData);
      const data = response.data;
      const completeUrl = data.file_url.startsWith('http')
        ? data.file_url
        : `http://175.116.3.178:8002${data.file_url}`;
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

  // 다크 테마 팔레트 적용
  const palette = {
    textPrimary: '#f2f3f5',
    textSecondary: '#ddd',
    textMuted: '#9ca3af',
    panelBg: '#1e1e25',
    border: '#2b2b36',
    borderAlt: '#2c2c35',
    inputBorder: '#40404f',
    hoverBg: '#1d1d38',
    btnBg: '#2b2b36',
    btnHover: '#242447',
    focus: '#5a63ff',
  };

  return (
    <>
      <style>{`
        .audio-generator-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: ${palette.textPrimary};
          background: transparent; /* 상위 배경(#15151e) 유지 가정 */
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
        textarea {
          width: 100%;
          padding: 10px;
          font-size: 16px;
          border: 1px solid ${palette.inputBorder};
          border-radius: 8px;
          background: ${palette.panelBg};
          color: ${palette.textPrimary};
          resize: vertical;
          outline: none;
        }
        textarea:focus {
          border-color: ${palette.focus};
          box-shadow: 0 0 0 2px ${palette.focus}20 inset;
        }
        button[type="submit"] {
          margin-top: 10px;
          padding: 10px 20px;
          border: 1px solid ${palette.border};
          background-color: ${palette.btnBg};
          color: ${palette.textPrimary};
          border-radius: 9999px;
          cursor: pointer;
          transition: background-color 0.2s, border-color 0.2s;
        }
        button[type="submit"]:hover {
          background-color: ${palette.btnHover};
        }
        button[type="submit"]:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .error {
          color: #ff4d4f;
          margin-top: 10px;
        }
        .audio-player {
          margin-top: 20px;
          background: ${palette.panelBg};
          border: 1px solid ${palette.border};
          border-radius: 8px;
          padding: 10px;
        }
      `}</style>

      <div className="audio-generator-container">

        {!user ? (
          <p className="error">⚠️ 로그인 후 이용 가능합니다.</p>
        ) : (
          <>
            <div className="presets-grid">
              {presets.map((p, idx) => (
                <button
                  key={p.name}
                  onClick={() => handlePresetClick(p)}
                  onMouseEnter={() => setHoverIndex(idx)}
                  onMouseLeave={() => setHoverIndex(-1)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '60px',
                    border: `1px solid ${palette.border}`,
                    backgroundColor: hoverIndex === idx ? palette.hoverBg : palette.panelBg,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: palette.textPrimary,
                    transition: 'background-color 0.15s, border-color 0.15s',
                    lineHeight: 0, // 아이콘 수직정렬 이슈 방지
                  }}
                  title={p.name}
                >
                  {p.icon}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', color: palette.textSecondary, marginBottom: 6 }}>
                효과음 설명
              </label>
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setPresetName(null);
                  setThumbnailUrl(null);
                }}
                placeholder="효과음에 대한 설명을 입력하세요. "
                rows={4}
              />

              <button type="submit" disabled={loading}>
                {loading ? '생성 중...' : ' 효과음 생성'}
              </button>
            </form>

            {error && <p className="error">{error}</p>}
            {audioUrl && (
              <div className="audio-player">
                <audio controls src={audioUrl} style={{ width: '100%' }}></audio>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default AudioGenerator;
