import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAxiosInstance } from '../api';

const BASE_URL =
  'http://175.116.3.178:8000';

function ProjectList({ token }) {
  const [projects, setProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]); // 삭제할 프로젝트 ID 목록
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // fetchProjects 함수를 useCallback으로 감싸서 token 변경 시에만 새로 생성되도록 함
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const api = createAxiosInstance(token);
      const res = await api.get('/projects');
      setProjects(res.data.projects || []);
    } catch (error) {
      console.error(error);
      setProjects([]);
    }
    setLoading(false);
  }, [token]);

  // useEffect 의존성 배열에 fetchProjects를 포함하여 함수의 최신 버전을 사용하도록 함
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 프로젝트 카드 클릭 시 상세 페이지로 이동
  const handleProjectClick = (projectId) => {
    navigate(`/editor/${projectId}`);
  };

  // 체크박스 상태 변경
  const toggleProjectSelection = (projectId) => {
    setSelectedProjects((prevSelected) =>
      prevSelected.includes(projectId)
        ? prevSelected.filter((id) => id !== projectId)
        : [...prevSelected, projectId]
    );
  };

  // 선택한 프로젝트 삭제 (휴지통 버튼)
  const handleDeleteProjects = async () => {
    if (selectedProjects.length === 0) {
      alert('삭제할 프로젝트를 선택하세요.');
      return;
    }
    if (!window.confirm('선택한 프로젝트를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const api = createAxiosInstance(token);
      // 여러 프로젝트를 반복적으로 삭제 (백엔드 DELETE 엔드포인트: /projects/{project_id})
      for (const projectId of selectedProjects) {
        await api.delete(`/projects/${projectId}`);
      }
      alert('선택한 프로젝트가 삭제되었습니다.');
      // 삭제 후, 삭제 상태 초기화하고 새로고침
      setSelectedProjects([]);
      fetchProjects();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  return (
    <div style={styles.container}>
      <h2>프로젝트 목록</h2>
      <div style={styles.buttonContainer}>
        <button onClick={fetchProjects}>새로고침</button>
        <button onClick={handleDeleteProjects}>휴지통</button>
      </div>
      {loading ? (
        <p>로딩 중...</p>
      ) : projects.length === 0 ? (
        <p>등록된 프로젝트가 없습니다.</p>
      ) : (
        <div style={styles.grid}>
          {projects.map((proj) => (
            <div key={proj.project_id} style={styles.card}>
              <div style={styles.cardHeader}>
                <input
                  type="checkbox"
                  checked={selectedProjects.includes(proj.project_id)}
                  onChange={() => toggleProjectSelection(proj.project_id)}
                  style={styles.checkbox}
                />
                <div
                  onClick={() => handleProjectClick(proj.project_id)}
                  style={{ cursor: 'pointer', flexGrow: 1 }}
                >
                  <h4>{proj.project_name}</h4>
                </div>
              </div>
              <p>{proj.description}</p>
              <img
                src={`${BASE_URL}/videos/${
                  proj.file_name || 'placeholder.png'
                }`}
                alt={proj.project_name}
                style={styles.thumb}
                onClick={() => handleProjectClick(proj.project_id)}
              />
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
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '8px',
  },
  checkbox: {
    cursor: 'pointer',
  },
  thumb: {
    width: '100%',
    height: '100px',
    objectFit: 'cover',
    cursor: 'pointer',
  },
};

export default ProjectList;
