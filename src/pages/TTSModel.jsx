import React, { useState } from 'react';

function CreateVoiceCloneForm() {
  // 폼 상태값
  const [name, setName] = useState('');
  const [files, setFiles] = useState([]);
  const [removeBackgroundNoise, setRemoveBackgroundNoise] = useState(false);
  const [gender, setGender] = useState('male');
  const [language, setLanguage] = useState('ko');
  const [message, setMessage] = useState('');

  // 고정 필드 너비
  const fieldWidth = '120px';

  // 파일 변경 핸들러
  const handleFileChange = (e) => {
    setFiles(e.target.files);
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('name', name);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    formData.append('remove_background_noise', removeBackgroundNoise);
    formData.append('description', null);
    const labelsObj = { gender, lang: language };
    formData.append('labels', JSON.stringify(labelsObj));

    try {
      const response = await fetch('http://175.116.3.178:8001/create-voice-model', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(`Server 상태 ${response.status}`);
      const result = await response.json();
      setMessage(
        `🎉 보이스 모델 생성 완료! voice_id: ${result.voice_id}, db_id: ${result.db_id}`
      );
    } catch (err) {
      console.error(err);
      setMessage(`❌ 오류: ${err.message}`);
    }
  };

  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '1rem',
      }}
    >
      <h1 style={{ color: '#fff' }}>🧬 보이스 모델 생성</h1>
      <form onSubmit={handleSubmit}>
        {/* 모델 이름 (너비 1/3) */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: '#ddd' }}>모델 이름 (필수)</label>
          <br />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              width: '33%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #444',
            }}
          />
        </div>

        {/* 음성 샘플 업로드 */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: '#ddd' }}>
            음성 샘플 업로드 (필수, 10MB 제한)
          </label>
          <br />
          <input
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileChange}
          />
        </div>

        {/* 배경 소음 제거 */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: '#ddd' }}>
            <input
              type="checkbox"
              checked={removeBackgroundNoise}
              onChange={(e) => setRemoveBackgroundNoise(e.target.checked)}
            />{' '}
            배경 소음 제거
          </label>
        </div>

        {/* 성별 + 언어 가로 배치 */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1rem',
            alignItems: 'flex-end',
          }}
        >
          {/* 성별 */}
          <div style={{ flex: 1 }}>
            <label style={{ color: '#ddd' }}>성별</label>
            <br />
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={{
                width: fieldWidth,
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #444',
              }}
            >
              <option value="male">남성</option>
              <option value="female">여성</option>
              <option value="other">기타</option>
            </select>
          </div>

          {/* 언어 */}
          <div style={{ flex: 1 }}>
            <label style={{ color: '#ddd' }}>언어</label>
            <br />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                width: fieldWidth,
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #444',
              }}
            >
              <option value="ko">한국어</option>
              <option value="en">English(영어)</option>
              <option value="ja">日本語(일본어)</option>
              <option value="zh">中文(중국어)</option>
            </select>
          </div>
        </div>

        {/* 제출 버튼 아래 배치 */}
        <div>
          <button
            type="submit"
            style={{
              padding: '10px',
              backgroundColor: '#7289da',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            모델 생성
          </button>
        </div>
      </form>

      {message && (
        <div
          style={{
            marginTop: '1rem',
            color: message.startsWith('❌') ? '#f04747' : '#43b581',
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

export default CreateVoiceCloneForm;