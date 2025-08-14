import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
};

const Script = () => {
  const dispatch = useDispatch();
  const audioTracks = useSelector((state) => state.audioTracks);

  const [editedTexts, setEditedTexts] = useState({});

  // ✅ 알림 모달 상태
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertData, setAlertData] = useState({
    title: '',
    message: '',
    type: 'success', // 'success' | 'error'
  });

  // ✅ 성공 알림 자동 닫기
  useEffect(() => {
    if (!alertOpen) return;
    if (alertData.type !== 'success') return;
    const t = setTimeout(() => setAlertOpen(false), 1500);
    return () => clearTimeout(t);
  }, [alertOpen, alertData.type]);

  // ✅ useEffect로 editedTexts 초기화
  useEffect(() => {
    const valid = audioTracks
      .flatMap((group) => group.tracks)
      .filter((track) => track.originalText && track.translatedText);

    const initial = {};
    valid.forEach((track) => {
      initial[track.id] = {
        originalText: track.originalText,
        translatedText: track.translatedText,
      };
    });
    setEditedTexts(initial);
  }, [audioTracks]);

  // ✅ 사용자 입력 핸들링
  const handleChange = (id, field, value) => {
    setEditedTexts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  // ✅ 서버로 수정 요청 보내고 store + 로컬 상태 반영
  const handleSubmit = async (trackId) => {
    const allTracks = audioTracks.flatMap((g) => g.tracks);
    const track = allTracks.find((t) => t.id === trackId);
    const edited = editedTexts[trackId];
    if (!track || !edited) return;

    const formData = new FormData();
    formData.append('tts_id', track.id);
    formData.append('voice', track.voice);
    formData.append('text', edited.originalText); // ← 사용자가 수정한 텍스트

    try {
      const res = await fetch('http://175.116.3.178:8001/edit-tts', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`서버 오류: ${res.status} ${errorText}`);
      }

      const result = await res.json();

      // ✅ 성공 알림 (먼저 띄움)
      setAlertData({
        title: '수정 완료',
        message: result?.message || '변경이 적용되었습니다.',
        type: 'success',
      });
      setAlertOpen(true);

      // ✅ Redux store 업데이트
      dispatch({
        type: 'EDIT_TTS',
        payload: {
          id: result.id,
          duration: result.duration,
          url: result.url,
          translatedText: result.translateText,
          originalText: result.originalText,
        },
      });

      // ✅ 로컬 상태 업데이트
      setEditedTexts((prev) => ({
        ...prev,
        [result.id]: {
          originalText: result.originalText,
          translatedText: result.translateText,
        },
      }));
    } catch (e) {
      console.error(e);
      setAlertData({
        title: '수정 실패',
        message: e.message,
        type: 'error',
      });
      setAlertOpen(true);
    }
  };

  const validTracks = audioTracks
    .flatMap((group) => group.tracks)
    .filter((track) => track.originalText && track.translatedText)
    .sort((a, b) => a.startTime - b.startTime); // ⬅ startTime 기준 정렬

  return (
    <div className="p-4 font-['Inter','Noto_Sans',sans-serif] text-white bg-[#15151e]">

      {validTracks.map((track) => {
        const { id, startTime, duration } = track;
        const endTime = startTime + duration;
        const edited = editedTexts[id] || {};

        return (
          <div
            key={id}
            className="mb-6 rounded-xl bg-[#1e1e25] p-4 shadow-[0_0_4px_rgba(0,0,0,0.1)] flex flex-col gap-4"
          >
            {/* ───────── 입력 영역 ───────── */}
            <div className="flex flex-col gap-4 md:flex-row">
              {/* Original */}
              <label className="flex flex-1 flex-col gap-2">
                <span className="text-sm font-medium">Original Text</span>
                <textarea
                  value={edited.originalText || ''}
                  onChange={(e) =>
                    handleChange(id, 'originalText', e.target.value)
                  }
                  className="h-24 w-full resize-y rounded-md border border-[#40404f] bg-transparent px-3 py-2 text-sm placeholder:text-[#a2a2b4] focus:outline-none"
                  placeholder="원본 입력…"
                />
              </label>

              {/* Translated */}
              <label className="flex flex-1 flex-col gap-2">
                <span className="text-sm font-medium">Translated Text</span>
                <textarea
                  value={edited.translatedText || ''}
                  onChange={(e) =>
                    handleChange(id, 'translatedText', e.target.value)
                  }
                  className="h-24 w-full resize-y rounded-md border border-[#40404f] bg-transparent px-3 py-2 text-sm text-[#1a73e8] placeholder:text-[#a2a2b4] focus:outline-none"
                  placeholder="번역 입력…"
                />
              </label>
            </div>

            {/* ───────── 버튼 + 시간대 ───────── */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => handleSubmit(id)}
                className="h-8 rounded-full bg-[#2b2b36] hover:bg-[#1d1d38] px-4 text-sm font-medium"
              >
                수정요청
              </button>

              <span className="text-sm text-[#a2a2b4]">
                {formatTime(startTime)} – {formatTime(endTime)}
              </span>
            </div>
          </div>
        );
      })}

      {/* ───────── 알림 모달 ───────── */}
      {alertOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1e1e25] p-6 rounded-2xl w-[90%] max-w-[400px]">
            <div className="flex items-start gap-3 mb-3">
              {/* 아이콘 */}
              <div
                className={
                  'mt-1 w-6 h-6 rounded-full flex items-center justify-center ' +
                  (alertData.type === 'success' ? 'bg-green-600/20' : 'bg-red-600/20')
                }
              >
                <span className={alertData.type === 'success' ? 'text-green-400' : 'text-red-400'}>
                  {alertData.type === 'success' ? '✓' : '✕'}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">{alertData.title}</h3>
                <p className="mt-1 text-sm text-[#a2a2b4] whitespace-pre-line">{alertData.message}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              {alertData.type === 'error' && (
                <button
                  onClick={() => setAlertOpen(false)}
                  className="flex-1 h-9 rounded-full bg-transparent border border-[#40404f] px-4 text-sm font-medium text-white"
                >
                  닫기
                </button>
              )}
              <button
                onClick={() => setAlertOpen(false)}
                className="flex-1 h-9 rounded-full bg-[#2b2b36] px-4 text-sm font-medium text-white"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Script;
