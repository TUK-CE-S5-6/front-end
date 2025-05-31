import React, { useState } from 'react';
import axios from 'axios';

const voiceOptions = [
  { label: 'Drew', value: '29vD33N1CtxCmqQRPOHJ' },   // A
  { label: 'Rachel', value: '21m00Tcm4TlvDq8ikWAM' }, // B
  { label: 'Paul', value: '5Q0t7uMcjvnagumLfvZi' },   // C
];

const TTSGenerator = () => {
  const [voiceId, setVoiceId] = useState('');
  const [text, setText] = useState('');
  const [ttsIdResult, setTtsIdResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 로컬스토리지에서 userId 꺼내기
  const getUserId = () => localStorage.getItem('userId');

  const handleGenerateTTS = async () => {
    if (!voiceId || !text) {
      setError('⚠️ Voice를 선택하고 텍스트를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setTtsIdResult(null);

    try {
      const userId = getUserId();
      if (!userId) {
        throw new Error(
          'userId가 없습니다. 로그인 후 페이지를 새로고침 해주세요.'
        );
      }

      // FormData 생성
      const formData = new FormData();
      formData.append('text', text);
      formData.append('voice_id', voiceId);
      formData.append('user_id', userId);

      // FormData 전송 (Content-Type은 axios가 자동 설정)
      const response = await axios.post(
        'http://175.116.3.178:8001/generate-tts',
        formData
      );

      if (response.data.tts_id) {
        setTtsIdResult(response.data.tts_id);
      } else {
        setError('❌ TTS 생성에 실패했습니다. (tts_id 없음)');
      }
    } catch (err) {
      console.error('🔴 서버 오류 발생:', err);
      if (err.response) {
        setError(
          `❌ 서버 오류: ${err.response.status} - ${
            err.response.data.detail || '알 수 없는 오류'
          }`
        );
      } else {
        setError(`❌ 요청 중 오류 발생: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: 'auto', textAlign: 'center' }}>
      <h2>🎙️ TTS Generator</h2>

      <select
        value={voiceId}
        onChange={(e) => setVoiceId(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '10px',
          borderRadius: '5px',
          border: '1px solid #ccc',
        }}
      >
        <option value="" disabled>
          보이스 선택
        </option>
        {voiceOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <textarea
        placeholder="텍스트 입력"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows="4"
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '10px',
          borderRadius: '5px',
          border: '1px solid #ccc',
          resize: 'none',
        }}
      />

      <button
        onClick={handleGenerateTTS}
        disabled={loading}
        style={{
          backgroundColor: '#007bff',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '5px',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '생성 중...' : 'TTS 생성'}
      </button>

      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}

      {ttsIdResult && (
        <p style={{ color: 'green', marginTop: '10px' }}>
          ✅ TTS 생성 완료! ID: {ttsIdResult}
        </p>
      )}
    </div>
  );
};

export default TTSGenerator;
