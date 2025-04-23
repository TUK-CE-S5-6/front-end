// ProjectAddModule.jsx
import React, { useState } from 'react';
import { createAxiosInstance } from '../api';

function ProjectAddModule({ token, onProjectAdded }) {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState(''); // 설명 상태 추가
  const [sourceLang, setSourceLang] = useState('ko-KR');
  const [targetLang, setTargetLang] = useState('en-US');
  const [videoFile, setVideoFile] = useState(null);

  const handleAddProject = async () => {
    if (!videoFile) {
      alert('영상 파일을 선택하세요.');
      return;
    }
    try {
      const api = createAxiosInstance(token);

      // 1. 프로젝트 생성 (설명을 포함)
      const formDataProj = new FormData();
      formDataProj.append('project_name', projectName);
      formDataProj.append('description', description);
      const resProject = await api.post('/projects/add', formDataProj);
      const projectId = resProject.data.project_id;

      // 2. 영상 업로드 및 언어 설정
      const formDataVideo = new FormData();
      formDataVideo.append('file', videoFile);
      formDataVideo.append('source_language', sourceLang);
      formDataVideo.append('target_language', targetLang);
      formDataVideo.append('project_id', projectId);
      await api.post('/upload-video', formDataVideo);

      alert('프로젝트 생성 및 영상 업로드 성공');
      onProjectAdded();
      // 초기화
      setProjectName('');
      setDescription('');
      setSourceLang('ko-KR');
      setTargetLang('en-US');
      setVideoFile(null);
    } catch (error) {
      alert(error?.response?.data?.detail || '프로젝트 추가 실패');
    }
  };

  const handleReset = () => {
    setProjectName('');
    setDescription('');
    setSourceLang('ko-KR');
    setTargetLang('en-US');
    setVideoFile(null);
  };

  return (
    <div style={styles.container}>
      <h3>프로젝트 추가</h3>
      {token ? (
        <>
          <div style={styles.row}>
            <label>영상 업로드</label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files[0])}
            />
          </div>
          <div style={styles.row}>
            <label>프로젝트 이름</label>
            <input
              type="text"
              placeholder="프로젝트 이름"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          <div style={styles.row}>
            <label>설명</label>
            <input
              type="text"
              placeholder="프로젝트 설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div style={styles.row}>
            <label>원본 언어</label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
            >
              <option value="ko-KR">한국어 (ko-KR)</option>
              <option value="en-US">영어 (en-US)</option>
              <option value="ja">일본어 (ja)</option>
              <option value="zh-cn">중국어 간체 (zh-cn)</option>
              <option value="zh-tw">중국어 번체 (zh-tw)</option>
            </select>
          </div>
          <div style={styles.row}>
            <label>번역 언어</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
            >
              <option value="en-US">영어 (en-US)</option>
              <option value="ko-KR">한국어 (ko-KR)</option>
              <option value="ja">일본어 (ja)</option>
              <option value="zh-cn">중국어 간체 (zh-cn)</option>
              <option value="zh-tw">중국어 번체 (zh-tw)</option>
            </select>
          </div>
          <div style={styles.buttonRow}>
            <button onClick={handleAddProject}>추가하기</button>
            <button onClick={handleReset}>초기화</button>
          </div>
        </>
      ) : (
        <p>로그인 후 이용 가능합니다.</p>
      )}
    </div>
  );
}

const styles = {
  container: {
    border: '1px solid #999',
    padding: '12px',
    backgroundColor: '#eee',
    flexGrow: 1,
    marginTop: '8px',
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '8px',
  },
  buttonRow: {
    display: 'flex',
    gap: '8px',
  },
};

export default ProjectAddModule;
