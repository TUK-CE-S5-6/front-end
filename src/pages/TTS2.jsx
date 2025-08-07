import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TTSGenerator = () => {
  const [voiceOptions, setVoiceOptions] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ttsIdResult, setTtsIdResult] = useState(null);

  const getUserId = () => localStorage.getItem('userId');

  useEffect(() => {
    // 페이지 로드 시 서버에서 보이스 모델 목록 불러오기
    axios
      .get('http://175.116.3.178:8001/voice-models')
      .then((res) => {
        setVoiceOptions(
          res.data.map((vm) => ({
            id: vm.db_id,
            label: vm.name,
            value: vm.voice_id,
            imageUrl: vm.image_url, // ← NEW: 이미지 URL 추가
          }))
        );
      })
      .catch((err) => console.error('보이스 목록 로드 실패:', err));
  }, []);

  const openModal = (voice) => {
    setSelectedVoice(voice);
    setTextInput('');
    setError(null);
    setTtsIdResult(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedVoice(null);
    setError(null);
  };

  const handleGenerate = async () => {
    if (!textInput) {
      setError('⚠️ 텍스트를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    setTtsIdResult(null);

    try {
      const userId = getUserId();
      if (!userId)
        throw new Error('userId가 없습니다. 로그인 후 새로고침 해주세요.');

      const formData = new FormData();
      formData.append('text', textInput);
      formData.append('voice_id', selectedVoice.value);
      formData.append('user_id', userId);

      const response = await axios.post(
        'http://175.116.3.178:8001/generate-tts',
        formData
      );

      if (response.data.tts_id) {
        setTtsIdResult(response.data.tts_id);
      } else {
        setError('❌ TTS 생성에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      setError(
        `❌ 오류: ${err.response?.status || ''} ${
          err.response?.data?.detail || err.message
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}
    >
      <h2>🎤 텍스트-음성 변환기</h2>

      {voiceOptions.map((voice) => (
        <div
          key={voice.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* ← NEW: 1:1 비율, 텍스트 크기(1em)에 맞춘 썸네일 */}
            <img
              src={`http://175.116.3.178:8001${voice.imageUrl}`}
              alt={`${voice.label} thumbnail`}
              style={{
                width: '4em',
                height: '4em',
                objectFit: 'cover',
                borderRadius: '0.125em',
                marginRight: '0.5em',
              }}
            />
            <span>{voice.label}</span>
          </div>
          <button
            onClick={() => openModal(voice)}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid #000',
              backgroundColor: '#007bff',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            TTS 생성
          </button>
        </div>
      ))}

      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '300px',
              textAlign: 'center',
            }}
          >
            <h3>{selectedVoice.label} TTS</h3>
            <textarea
              rows={4}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="텍스트 입력"
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '10px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                resize: 'none',
              }}
            />
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {ttsIdResult && (
              <p style={{ color: 'green' }}>✅ ID: {ttsIdResult}</p>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '10px',
              }}
            >
              <button
                onClick={handleGenerate}
                disabled={loading}
                style={{
                  flex: 1,
                  marginRight: '5px',
                  padding: '8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: '#007bff',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {loading ? '생성 중...' : '생성'}
              </button>
              <button
                onClick={closeModal}
                style={{
                  flex: 1,
                  marginLeft: '5px',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TTSGenerator;
