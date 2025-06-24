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
          originalText: edited.originalText,
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
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h1>📝대본</h1>
      {validTracks.map((track) => {
        const { id, startTime, duration } = track;
        const endTime = startTime + duration;
        const edited = editedTexts[id] || {};

        return (
          <div
            key={id}
            style={{
              border: '1px solid #ccc',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              background: '#fafafa',
            }}
          >
            <div style={{ display: 'flex', gap: '1rem' }}>
              {/* 원본 텍스트 수정 */}
              <div style={{ flex: 1, padding: '10px' }}>
                <h4 style={{ color: '#333', marginBottom: '0.5rem' }}>
                  원본 텍스트
                </h4>
                <textarea
                  value={edited.originalText || ''}
                  onChange={(e) =>
                    handleChange(id, 'originalText', e.target.value)
                  }
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '0.5rem',
                    border: '1px solid #aaa',
                    borderRadius: '4px',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* 번역 텍스트 수정 */}
              <div style={{ flex: 1, padding: '10px' }}>
                <h4 style={{ color: '#1a73e8', marginBottom: '0.5rem' }}>
                  번역 텍스트
                </h4>
                <textarea
                  value={edited.translatedText || ''}
                  onChange={(e) =>
                    handleChange(id, 'translatedText', e.target.value)
                  }
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '0.5rem',
                    border: '1px solid #aaa',
                    borderRadius: '4px',
                    resize: 'vertical',
                    color: '#1a73e8',
                  }}
                />
              </div>
            </div>

            {/* 시간 표시 */}
            <p
              style={{
                marginTop: '0.75rem',
                fontSize: '0.9rem',
                color: '#555',
              }}
            >
              <strong>시작:</strong> {formatTime(startTime)} &nbsp;|&nbsp;
              <strong>종료:</strong> {formatTime(endTime)}
            </p>

            {/* 수정 요청 버튼 */}
            <button
              onClick={() => handleSubmit(id)}
              style={{
                marginTop: '0.5rem',
                padding: '0.4rem 1rem',
                fontSize: '0.9rem',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              TTS 수정 요청
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default Script;