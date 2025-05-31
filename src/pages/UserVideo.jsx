// src/pages/UserFileManager.jsx
import React, { useState, useEffect } from 'react';

const BASE_URL = 'http://175.116.3.178:8000';

const UserFileManager = () => {
  const [files, setFiles] = useState([]);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [expandedIndex, setExpandedIndex] = useState(null);

  const token = localStorage.getItem('authToken');
  const getAuthHeaders = () => ({ Authorization: `Bearer ${token}` });

  // 1) 서버에서 전체 파일 목록을 가져와서 state에 저장
  const fetchFiles = async () => {
    try {
      const response = await fetch(`${BASE_URL}/user-files`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setFiles(data.files);
      }
    } catch (err) {
      console.error('네트워크 오류 발생', err);
    }
  };

  // 2) 드래그 시작할 때 file_url과 duration을 JSON으로 담아서 전달
  const handleDragStart = (e, file) => {
    const payload = JSON.stringify({
      url: file.file_url,
      duration: file.duration ?? 0,
    });
    e.dataTransfer.setData('application/json', payload);
  };

  // 3) 서버에 파일 삭제 요청
  const handleDelete = async (fileName) => {
    if (!window.confirm(`"${fileName}" 파일을 삭제하시겠습니까?`)) return;
    try {
      const response = await fetch(
        `${BASE_URL}/user-files?file=${encodeURIComponent(fileName)}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setDeleteMessage(`삭제 실패: ${data.detail}`);
      } else {
        setDeleteMessage('파일 삭제 성공!');
        fetchFiles();
      }
    } catch {
      setDeleteMessage('네트워크 오류 발생');
    }
  };

  // 4) 파일 다운로드
  const handleDownload = async (fileName) => {
    try {
      const response = await fetch(
        `${BASE_URL}/download-file?file_name=${encodeURIComponent(fileName)}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error('다운로드 실패');
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
    } catch {
      alert('파일 다운로드 중 오류 발생');
    }
  };

  // 5) 상세 정보 토글
  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  // 컴포넌트 마운트 시 한 번만 파일 목록 로드
  useEffect(() => {
    fetchFiles();
  }, []);

  // **video 파일만** 필터링
  const videoFiles = files.filter((f) => f.file_type.startsWith('video'));

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      <section>
        {/* 목록 새로고침 버튼만 최상단에 */}
        <button onClick={fetchFiles}>파일 목록 새로고침</button>

        {videoFiles.length === 0 ? (
          <p>업로드된 비디오 파일이 없습니다.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {videoFiles.map((file, index) => (
              <li
                key={index}
                draggable
                onDragStart={(e) => handleDragStart(e, file)}
                style={{
                  marginBottom: '10px',
                  padding: '8px',
                  border: '1px solid #ccc',
                  cursor: 'grab',
                }}
              >
                <strong>{file.file_name}</strong>{' '}
                <button onClick={() => handleDownload(file.file_name)}>
                  다운로드
                </button>{' '}
                <button onClick={() => handleDelete(file.file_name)}>
                  삭제
                </button>{' '}
                <button onClick={() => toggleExpand(index)}>
                  {expandedIndex === index ? '접기' : '펼치기'}
                </button>

                {expandedIndex === index && (
                  <div
                    style={{
                      marginTop: '5px',
                      marginLeft: '20px',
                      fontSize: '0.9em',
                    }}
                  >
                    <p>📄 타입: {file.file_type}</p>
                    {file.duration != null && (
                      <p>⏱ 길이: {file.duration.toFixed(2)}초</p>
                    )}
                    <p>
                      🔗 URL:{' '}
                      <a
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {file.file_url}
                      </a>
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {deleteMessage && <p>{deleteMessage}</p>}
      </section>
    </div>
  );
};

export default UserFileManager;
