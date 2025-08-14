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
        `❌ 오류: ${err.response?.status || ''} ${err.response?.data?.detail || err.message
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex w-full min-h-screen flex-col bg-[#111118] dark group/design-root overflow-x-hidden"
      style={{ fontFamily: "Manrope, 'Noto Sans', sans-serif" }}
    >
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-6 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col w-full max-w-[920px]">


            {voiceOptions.map(voice => (
              <div
                key={voice.id}
                className="flex items-center justify-between bg-[#111118] px-4 py-2 mb-4 min-h-[72px] rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={`http://175.116.3.178:8001${voice.imageUrl}`}
                    alt={`${voice.label} thumbnail`}
                    className="h-14 w-14 object-cover rounded-md"
                  />
                  <span className="text-white text-base font-medium">
                    {voice.label}
                  </span>
                </div>
                <button
                  onClick={() => openModal(voice)}
                  className="h-8 rounded-full bg-[#2b2b36] hover:bg-[#1d1d38] px-4 text-sm font-medium text-white"
                >
                  TTS 생성
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1e1e25] p-6 rounded-2xl w-[90%] max-w-[400px]">
            <h3 className="text-lg font-bold text-white mb-4">
              {selectedVoice.label} TTS
            </h3>
            <textarea
              rows={4}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="텍스트 입력"
              className="w-full h-24 resize-none rounded-md border border-[#40404f] bg-transparent px-3 py-2 text-sm text-white placeholder:text-[#a2a2b4] focus:outline-none mb-2"
            />
            {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
            {ttsIdResult && (
              <p className="text-sm text-green-500 mb-2">
                ✅ ID: {ttsIdResult}
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 h-8 rounded-full bg-[#2b2b36] px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? '생성 중...' : '생성'}
              </button>
              <button
                onClick={closeModal}
                className="flex-1 h-8 rounded-full bg-transparent border border-[#40404f] px-4 text-sm font-medium text-white"
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