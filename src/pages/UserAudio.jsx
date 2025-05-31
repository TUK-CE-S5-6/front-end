import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';

const BASE_URL = 'http://175.116.3.178:8000';

// 파형 이미지 생성 함수
const generateWaveformImage = (audioBuffer, width, height) => {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#007bff';
    const data = audioBuffer.getChannelData(0);
    const step = Math.floor(data.length / width);
    for (let i = 0; i < width; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += Math.abs(data[i * step + j]);
      const barHeight = (sum / step) * height;
      ctx.fillRect(i, (height - barHeight) / 2, 1, barHeight);
    }
    resolve(canvas.toDataURL());
  });
};

const UserAudio = () => {
  const dispatch = useDispatch();
  const [files, setFiles] = useState([]);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [expandedIndex, setExpandedIndex] = useState(null);

  const token = localStorage.getItem('authToken');
  const getAuthHeaders = () => ({ Authorization: `Bearer ${token}` });

  // 서버에서 파일 목록 불러오고 파형 이미지 미리 생성
  const fetchFiles = async () => {
    try {
      const res = await fetch(`${BASE_URL}/user-files`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) return;
      const audioFiles = data.files.filter(f => f.file_type.startsWith('audio'));
      const filesWithWave = await Promise.all(
        audioFiles.map(async file => {
          // 절대 URL 생성
          let srcUrl = file.file_url;
          if (!srcUrl.startsWith('http')) {
            const path = srcUrl.replace(/\\/g, '/').replace(/^\//, '');
            srcUrl = `${BASE_URL}/${path}`;
          }
          // 파형 생성
          let waveformImage = '';
          try {
            const arrayBuffer = await fetch(srcUrl, { headers: getAuthHeaders() }).then(r => r.arrayBuffer());
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioCtx();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            audioCtx.close();
            const width = Math.floor(audioBuffer.duration * 100);
            waveformImage = await generateWaveformImage(audioBuffer, width, 50);
          } catch (e) {
            console.error('파형 생성 실패', e);
          }
          return { ...file, file_url: srcUrl, waveformImage };
        })
      );
      setFiles(filesWithWave);
    } catch (e) {
      console.error('네트워크 오류', e);
    }
  };

  // 드래그 시작: url, duration, waveformImage 함께 전달
  const handleDragStart = (e, file) => {
    const { file_url: url, duration = 0, waveformImage = '' } = file;
    const payload = JSON.stringify({ url, duration, waveformImage });
    e.dataTransfer.setData('application/json', payload);
  };

  const handleDelete = async fileName => {
    if (!window.confirm(`"${fileName}"을(를) 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(
        `${BASE_URL}/user-files?file=${encodeURIComponent(fileName)}`,
        { method: 'DELETE', headers: getAuthHeaders() }
      );
      const data = await res.json();
      setDeleteMessage(res.ok ? '삭제 성공!' : `삭제 실패: ${data.detail}`);
      if (res.ok) fetchFiles();
    } catch {
      setDeleteMessage('네트워크 오류');
    }
  };

  const handleDownload = async fileName => {
    try {
      const res = await fetch(
        `${BASE_URL}/download-file?file_name=${encodeURIComponent(fileName)}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      alert('다운로드 오류');
    }
  };

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  useEffect(() => { fetchFiles(); }, []);

  return (
    <div style={{ padding: 20, maxWidth: 700, margin: '0 auto' }}>
      <button onClick={fetchFiles}>새로고침</button>
      {files.length === 0 ? (
        <p>오디오 파일이 없습니다.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {files.map((file, idx) => (
            <li
              key={file.file_name}
              draggable
              onDragStart={e => handleDragStart(e, file)}
              style={{ border: '1px solid #ccc', margin: '8px 0', padding: 8, cursor: 'grab' }}
            >
              <strong>{file.file_name}</strong>
              <button onClick={() => handleDownload(file.file_name)} style={{ margin: '0 8px' }}>다운로드</button>
              <button onClick={() => handleDelete(file.file_name)}>삭제</button>
              <button onClick={() => toggleExpand(idx)} style={{ marginLeft: 8 }}>
                {expandedIndex === idx ? '접기' : '펼치기'}
              </button>

              {expandedIndex === idx && (
                <>
                  {/* 파형 이미지 표시 */}
                  {file.waveformImage && (
                    <img
                      src={file.waveformImage}
                      alt="waveform"
                      style={{ width: '100%', height: 50, display: 'block', marginTop: 8 }}
                      draggable={false}
                    />
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {deleteMessage && <p>{deleteMessage}</p>}
    </div>
  );
};

export default UserAudio;