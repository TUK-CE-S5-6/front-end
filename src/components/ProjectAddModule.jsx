import React, { useState } from 'react';
import { createAxiosInstance } from '../api';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

function ProjectAddModule({ token, onProjectAdded }) {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceLang, setSourceLang] = useState('ko-KR');
  const [targetLang, setTargetLang] = useState('en-US');
  const [videoFile, setVideoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);

  const handleAddProject = async () => {
    if (!videoFile) {
      alert('영상 파일을 선택하세요.');
      return;
    }

    setLoading(true);
    setProgress(0);
    setSuccess(false);
    setLastUpdateTime(0);

    try {
      const api = createAxiosInstance(token);
      // 1) 프로젝트 생성
      const formProj = new FormData();
      formProj.append('project_name', projectName);
      formProj.append('description', description);
      const resProj = await api.post('/projects/add', formProj);
      const projectId = resProj.data.project_id;

      // 2) WebSocket용 job_id 생성 및 연결
      const job_id = crypto.randomUUID();
      const socket = new WebSocket(`ws://175.116.3.178:8000/ws/progress/${job_id}`);

      // 5초 이상 interval로 업데이트
      const MIN_INTERVAL = 500;

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const now = Date.now();
        const elapsed = now - lastUpdateTime;
        if (elapsed >= MIN_INTERVAL) {
          setProgress(data.progress);
          setLastUpdateTime(now);
        } else {
          const remaining = MIN_INTERVAL - elapsed;
          setTimeout(() => {
            setProgress(data.progress);
            setLastUpdateTime(Date.now());
          }, remaining);
        }
        if (data.progress >= 100) {
          socket.close();
          setLoading(false);
          setSuccess(true);
          onProjectAdded();
        }
      };

      socket.onerror = (e) => {
        console.error('[WebSocket] 연결 오류', e);
        alert('WebSocket 연결 오류');
        setLoading(false);
      };

      socket.onclose = () => {
        console.log('[WebSocket] 연결 종료');
      };

      // 3) WebSocket open 대기 후 업로드 시작
      await new Promise((resolve) => {
        socket.onopen = () => resolve();
      });

      // 4) 업로드 트리거
      const formVideo = new FormData();
      formVideo.append('file', videoFile);
      formVideo.append('source_language', sourceLang);
      formVideo.append('target_language', targetLang);
      formVideo.append('project_id', projectId);
      await api.post(`/upload-video?job_id=${job_id}`, formVideo);
    } catch (err) {
      console.error('[AddProject] 오류:', err);
      alert(err?.response?.data?.detail || '프로젝트 추가 실패');
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (loading) return;
    setProjectName('');
    setDescription('');
    setSourceLang('ko-KR');
    setTargetLang('en-US');
    setVideoFile(null);
    setProgress(0);
    setSuccess(false);
    setLastUpdateTime(0);
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
              disabled={loading}
            />
          </div>
          <div style={styles.row}>
            <label>프로젝트 이름</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div style={styles.row}>
            <label>설명</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>
          <div style={styles.row}>
            <label>원본 언어</label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              disabled={loading}
            >
              <option value="ko-KR">한국어</option>
              <option value="en-US">영어</option>
              <option value="ja">일본어</option>
              <option value="zh-cn">중국어 간체</option>
              <option value="zh-tw">중국어 번체</option>
            </select>
          </div>
          <div style={styles.row}>
            <label>번역 언어</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              disabled={loading}
            >
              <option value="en-US">영어</option>
              <option value="ko-KR">한국어</option>
              <option value="ja">일본어</option>
              <option value="zh-cn">중국어 간체</option>
              <option value="zh-tw">중국어 번체</option>
            </select>
          </div>
          <div style={styles.buttonRow}>
            <button
              onClick={handleAddProject}
              disabled={loading || !projectName}
            >
              추가하기
            </button>
            <button onClick={handleReset} disabled={loading}>
              초기화
            </button>
          </div>

          {(loading || success) && (
            <div style={styles.progressContainer}>
              <div style={{ width: 60, height: 60 }}>
                <CircularProgressbar
                  value={progress}
                  text={`${progress}%`}
                  styles={buildStyles({
                    textSize: '32px',
                    pathColor: `rgba(62, 152, 199, ${progress / 100})`,
                    textColor: '#333',
                    trailColor: '#eee',
                  })}
                />
              </div>
            </div>
          )}

          {success && (
            <div style={styles.successMessage}>프로젝트 추가 성공</div>
          )}
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
  progressContainer: {
    marginTop: '12px',
    display: 'flex',
    justifyContent: 'center',
  },
  successMessage: {
    marginTop: '12px',
    color: '#28a745',
    fontWeight: 'bold',
    textAlign: 'center',
  },
};

export default ProjectAddModule;
