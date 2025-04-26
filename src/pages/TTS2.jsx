import React, { useState } from 'react';
import axios from 'axios';

const voiceOptions = [
  { id: 'A', label: 'Drew', value: '29vD33N1CtxCmqQRPOHJ' },
  { id: 'B', label: 'Rachel', value: '21m00Tcm4TlvDq8ikWAM' },
  { id: 'C', label: 'Paul', value: '5Q0t7uMcjvnagumLfvZi' },
];

const TTSGenerator = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ttsIdResult, setTtsIdResult] = useState(null);

  const getUserId = () => localStorage.getItem('userId');

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
      if (!userId) throw new Error('userId가 없습니다. 로그인 후 새로고침 해주세요.');

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
      setError(`❌ 오류: ${err.response?.status || ''} ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
      <h2>🎙️ TTS Generator_ver2</h2>
      {voiceOptions.map((voice) => (
        <div key={voice.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span>{voice.label}</span>
          <button
            onClick={() => openModal(voice)}
            style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #007bff', background: '#fff', cursor: 'pointer' }}
          >
            TTS 생성
          </button>
        </div>
      ))}

      {modalOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '300px', textAlign: 'center' }}>
            <h3>{selectedVoice.label} TTS</h3>
            <textarea
              rows={4}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="텍스트 입력"
              style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc', resize: 'none' }}
            />
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {ttsIdResult && <p style={{ color: 'green' }}>✅ ID: {ttsIdResult}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <button
                onClick={handleGenerate}
                disabled={loading}
                style={{ flex: 1, marginRight: '5px', padding: '8px', borderRadius: '4px', border: 'none', background: '#007bff', color: '#fff', cursor: 'pointer' }}
              >
                {loading ? '생성 중...' : '생성'}
              </button>
              <button
                onClick={closeModal}
                style={{ flex: 1, marginLeft: '5px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
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
