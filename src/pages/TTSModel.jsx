import React, { useState } from 'react';

function CreateVoiceCloneForm() {
  // 폼 상태값
  const [name, setName] = useState('');
  const [files, setFiles] = useState([]);
  const [removeBackgroundNoise, setRemoveBackgroundNoise] = useState(false);
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState('male');
  const [language, setLanguage] = useState('ko');
  const [message, setMessage] = useState('');

  // 파일 변경 핸들러
  const handleFileChange = (e) => {
    setFiles(e.target.files);
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('name', name);

    // 파일들
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    // 배경 소음 제거 옵션
    formData.append('remove_background_noise', removeBackgroundNoise);

    // optional description
    if (description) {
      formData.append('description', description);
    }

    // labels JSON (gender, language)
    const labelsObj = { gender, lang: language };
    formData.append('labels', JSON.stringify(labelsObj));

    try {
      const response = await fetch('http://175.116.3.178:8001/create-voice-model', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

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
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2>Create Voice Clone</h2>
      <form onSubmit={handleSubmit}>
        {/* name */}
        <div style={{ marginBottom: '10px' }}>
          <label>모델 이름 (Required):</label><br />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>

        {/* files */}
        <div style={{ marginBottom: '10px' }}>
          <label>음성 샘플 업로드 (Required 10MB 제한):</label><br />
          <input
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileChange}
          />
        </div>

        {/* remove noise */}
        <div style={{ marginBottom: '10px' }}>
          <label>
            <input
              type="checkbox"
              checked={removeBackgroundNoise}
              onChange={(e) => setRemoveBackgroundNoise(e.target.checked)}
            /> 배경 소음 제거
          </label>
        </div>

        {/* description */}
        <div style={{ marginBottom: '10px' }}>
          <label>설명 (Optional):</label><br />
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {/* gender select */}
        <div style={{ marginBottom: '10px' }}>
          <label>성별:</label><br />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            style={{ width: '100%', padding: '4px' }}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* language select */}
        <div style={{ marginBottom: '10px' }}>
          <label>언어:</label><br />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ width: '100%', padding: '4px' }}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>
        </div>

        <button type="submit" style={{ marginTop: '10px' }}>
          모델 생성
        </button>
      </form>

      {message && (
        <div style={{ marginTop: '20px', color: message.startsWith('❌') ? 'red' : 'green' }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default CreateVoiceCloneForm;