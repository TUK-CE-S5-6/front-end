import React from 'react';
import { useSelector } from 'react-redux';

// 초 단위 숫자(소수)를 "분:초.xx" 형식으로 바꿔주는 유틸
const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
};

const Script = () => {
  // 스토어에서 오디오 트랙 그룹만 가져옴
  const audioTracks = useSelector(state => state.audioTracks);

  // 원본과 번역 텍스트가 모두 있는 트랙만 필터링
  const validTracks = audioTracks
    .flatMap(group => group.tracks)
    .filter(track => track.originalText && track.translatedText);

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h2>스크립트</h2>
      {validTracks.map(track => {
        const { id, startTime, duration, originalText, translatedText } = track;
        const endTime = startTime + duration;

        return (
          <div
            key={id}
            style={{
              border: '1px solid #ccc',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              background: '#fafafa'
            }}
          >
            <div style={{ display: 'flex', gap: '1rem' }}>
              {/* 원본 텍스트 박스 */}
              <div
                style={{
                  flex: 1,
                  border: '1px solid #aaa',
                  borderRadius: '4px',
                  padding: '0.75rem',
                  background: '#fff'
                }}
              >
                <h4 style={{ margin: '0 0 0.5rem' }}>원본 텍스트</h4>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {originalText}
                </p>
              </div>

              {/* 번역 텍스트 박스 */}
              <div
                style={{
                  flex: 1,
                  border: '1px solid #aaa',
                  borderRadius: '4px',
                  padding: '0.75rem',
                  background: '#fff'
                }}
              >
                <h4 style={{ margin: '0 0 0.5rem' }}>번역 텍스트</h4>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {translatedText}
                </p>
              </div>
            </div>

            {/* 시간 표시 */}
            <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#555' }}>
              <strong>시작:</strong> {formatTime(startTime)}
              &nbsp;|&nbsp;
              <strong>종료:</strong> {formatTime(endTime)}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default Script;
