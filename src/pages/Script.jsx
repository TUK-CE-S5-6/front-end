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

      alert(`TTS 수정 완료: ${result.message}`);
    } catch (e) {
      console.error(e);
      alert('TTS 수정 실패: ' + e.message);
    }
  };

  const validTracks = audioTracks
    .flatMap((group) => group.tracks)
    .filter((track) => track.originalText && track.translatedText);

  return (
    <div className="p-4 font-['Inter','Noto_Sans',sans-serif] text-white bg-[#15151e]">
      <h1 className="mb-6 text-2xl font-bold">📝 대본</h1>

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
                className="h-8 rounded-full bg-[#2b2b36] px-4 text-sm font-medium"
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
    </div>
  );
};

export default Script;
