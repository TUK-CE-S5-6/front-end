import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAxiosInstance } from '../api';

const BASE_URL = 'http://175.116.3.178:8000';

function ProjectList({ token }) {
  const [projects, setProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = createAxiosInstance(token);
      const res = await api.get('/projects');
      // 썸네일 URL에 video_id 사용
      const projectsWithThumb = (res.data.projects || []).map((proj) => ({
        ...proj,
        thumbnail_url: `${BASE_URL}/thumbnails/${proj.video_id}.jpg`,
      }));
      setProjects(projectsWithThumb);
    } catch (err) {
      console.error(err);
      setError('프로젝트를 불러오는 중 오류가 발생했습니다.');
      setProjects([]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleProjectClick = (projectId) => {
    navigate(`/editor/${projectId}`);
  };

  const toggleProjectSelection = (projectId) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleDeleteProjects = async () => {
    if (selectedProjects.length === 0) {
      alert('삭제할 프로젝트를 선택하세요.');
      return;
    }
    if (!window.confirm('선택한 프로젝트를 삭제하시겠습니까?')) return;
    try {
      const api = createAxiosInstance(token);
      await Promise.all(
        selectedProjects.map((id) => api.delete(`/projects/${id}`))
      );
      setSelectedProjects([]);
      fetchProjects();
      alert('선택한 프로젝트가 삭제되었습니다.');
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  return (
    <div style={styles.container}>
      <h2>프로젝트 목록</h2>
      <div style={styles.buttonContainer}>
        <button onClick={fetchProjects}>새로고침</button>
        <button onClick={handleDeleteProjects}>휴지통</button>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {loading ? (
        <p>로딩 중...</p>
      ) : projects.length === 0 ? (
        <p>등록된 프로젝트가 없습니다.</p>
      ) : (
        <div style={styles.grid}>
          {projects.map((proj) => (
            <div key={proj.project_id} style={styles.card}>
              {/* 썸네일 */}
              <img
                src={proj.thumbnail_url || '/placeholder.png'}
                alt={proj.project_name}
                style={styles.thumb}
                onClick={() => handleProjectClick(proj.project_id)}
              />
              {/* 프로젝트 이름 및 체크박스 */}
              <div style={styles.cardHeader}>
                <input
                  type="checkbox"
                  checked={selectedProjects.includes(proj.project_id)}
                  onChange={() => toggleProjectSelection(proj.project_id)}
                  style={styles.checkbox}
                />
                <h4
                  onClick={() => handleProjectClick(proj.project_id)}
                  style={{ cursor: 'pointer', margin: 0 }}
                >
                  {proj.project_name}
                </h4>
              </div>
              {/* 설명 */}
              <p style={styles.description}>{proj.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#f0f0f0',
    padding: '16px',
    flex: 1,
  },
  buttonContainer: {
    marginBottom: '12px',
    display: 'flex',
    gap: '8px',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
  },
  card: {
    width: '180px',
    border: '1px solid #ccc',
    padding: '8px',
    backgroundColor: '#fff',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  thumb: {
    width: '100%',
    height: '100px',
    objectFit: 'cover',
    cursor: 'pointer',
    borderRadius: '4px',
    marginBottom: '8px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  checkbox: {
    cursor: 'pointer',
  },
  description: {
    marginTop: '4px',
    fontSize: '14px',
    color: '#555',
    flexGrow: 1,
  },
  error: {
    color: '#dc3545',
    marginBottom: '12px',
  },
};

export default ProjectList;
