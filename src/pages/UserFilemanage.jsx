// src/pages/UserFileManager.jsx
import React, { useState, useEffect, useRef } from 'react';

const BASE_URL = 'http://175.116.3.178:8000';

// 파형 이미지 생성 함수 (url -> dataURL)
async function fetchWaveform(url) {
  const token = localStorage.getItem('authToken');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`오디오 파일을 불러올 수 없습니다: ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const audioBuf = await ctx.decodeAudioData(arrayBuffer);
  ctx.close();

  const width = Math.floor(audioBuf.duration * 100);
  const height = 100;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d');
  c.fillStyle = '#fff';
  c.fillRect(0, 0, width, height);
  c.fillStyle = '#007bff';

  const data = audioBuf.getChannelData(0);
  const step = Math.floor(data.length / width);
  for (let i = 0; i < width; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += Math.abs(data[i * step + j]);
    const bar = (sum / step) * height;
    c.fillRect(i, (height - bar) / 2, 1, bar);
  }

  return canvas.toDataURL();
}

// 파일 타입 감지 헬퍼
const detectFileType = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'aac'].includes(ext)) return 'audio';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
  return 'other';
};

const UserFileManager = () => {
  const [files, setFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const fileInputRef = useRef();
  const token = localStorage.getItem('authToken');
  const getAuthHeaders = () => ({ Authorization: `Bearer ${token}` });

  // 파일 목록 조회 + 메타데이터 로딩
const fetchFiles = async () => {
  try {
    const res = await fetch(`${BASE_URL}/user-files`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const { files: data } = await res.json();

    // 각 파일마다 duration과 (오디오이면) waveformImage까지 미리 계산
    const processed = await Promise.all(data.map(async f => {
      const fileType = detectFileType(f.file_name);
      const file_url = f.file_url.startsWith('http')
        ? f.file_url
        : `${BASE_URL}${f.file_url}`;

      // 1) duration
      let duration = 0;
      if (fileType === 'video' || fileType === 'audio') {
        const media = document.createElement(fileType);
        media.preload = 'metadata';
        media.src = file_url;
        await new Promise(res => (media.onloadedmetadata = res));
        duration = media.duration;
      }

      // 2) thumbnail
      let thumbnailImage = f.thumbnail_url.startsWith('http')
        ? f.thumbnail_url
        : `${BASE_URL}${f.thumbnail_url}`;
      if (fileType === 'audio') {
        thumbnailImage = `${BASE_URL}/thumbnails/audio-placeholder.png`;
      }

      // 3) waveformImage (오디오만)
      let waveformImage = '';
      if (fileType === 'audio') {
        try {
          waveformImage = await fetchWaveform(file_url);
        } catch {
          console.error('파형 생성 실패', f.file_name);
        }
      }

      return {
        file_name: f.file_name,
        file_url,
        file_type: fileType,
        duration,           // 미리 계산된 길이
        thumbnailImage,
        waveformImage,      // 오디오만 있을 것
      };
    }));

    setFiles(processed);
  } catch (err) {
    console.error('파일 조회 실패', err);
  }
};


  useEffect(() => {
    fetchFiles();
    const timer = setInterval(fetchFiles, 1000);
    return () => clearInterval(timer);
  }, []);

  // 파일 업로드
  const handleFileChange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${BASE_URL}/upload-file`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd,
      });
      if (res.ok) fetchFiles();
    } catch {
      console.error('네트워크 오류');
    }
  };

  // 파일 삭제
  const handleDelete = async name => {
    if (!window.confirm(`"${name}" 삭제?`)) return;
    try {
      const res = await fetch(
        `${BASE_URL}/user-files?file=${encodeURIComponent(name)}`,
        { method: 'DELETE', headers: getAuthHeaders() }
      );
      if (res.ok) fetchFiles();
    } catch {
      console.error('네트워크 오류');
    }
  };

  // 필터 & 검색
  const filtered = files
    .filter(f =>
      filterType === 'all'
        ? true
        : filterType === 'video'
          ? f.file_type === 'video'
          : f.file_type === 'audio'
    )
    .filter(f => f.file_name.toLowerCase().includes(searchTerm.toLowerCase()));

  // 드래그 시작 핸들러
  

  
    // 이제 handleDragStart는 async가 아니어야 합니다!
const handleDragStart = (e, file) => {
  const payload = {
    url: file.file_url,
    thumbnailUrl: file.thumbnailImage,
    fileName: file.file_name,
    fileType: file.file_type,
    duration: file.duration,           // fetchFiles에서 미리 붙여준 값
    waveformImage: file.waveformImage, // fetchFiles에서 미리 붙여준 값
  };
  console.log('Drag Start Payload:', payload);
  e.dataTransfer.setData('application/json', JSON.stringify(payload));
};


  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h1>파일 관리</h1>

      {/* 검색 + 필터 + 업로드 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input
          placeholder="검색..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ flex: 1, padding: 4 }}
        />
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowFilterMenu(m => !m)}>필터 ▾</button>
          {showFilterMenu && (
            <div style={{ position: 'absolute', bottom: 8, right: 8, background: '#fff', border: '1px solid #dc3545', borderRadius: 4, padding: '2px 6px', fontSize: 12 }}>
              <button onClick={() => { setFilterType('all'); setShowFilterMenu(false); }}>전체</button>
              <button onClick={() => { setFilterType('video'); setShowFilterMenu(false); }}>비디오</button>
              <button onClick={() => { setFilterType('audio'); setShowFilterMenu(false); }}>오디오</button>
            </div>
          )}
        </div>
        <button onClick={() => fileInputRef.current.click()}>업로드</button>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      {/* 파일 목록: 고정 크기 그리드 */}
      {filtered.length === 0 ? (
        <p>파일 없음</p>
      ) : (
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 150px)', gap: 8, justifyContent: 'center' }}>
            {filtered.map((f, i) => (
              <li
                key={i}
                draggable
                onDragStart={e => handleDragStart(e, f)}
                style={{ position: 'relative', border: '1px solid #ccc', padding: 8, cursor: 'grab', display: 'flex', flexDirection: 'column' }}
              >
                {/* 썸네일 */}
                {f.thumbnailImage && (
                  <img
                    src={f.thumbnailImage}
                    alt={f.file_name}
                    style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', marginBottom: 8, borderRadius: 4 }}
                    draggable={false}
                  />
                )}
                {/* 파일명 */}
                <strong style={{ fontSize: 14, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 24 }}>
                  {f.file_name}
                </strong>
                {/* 삭제 버튼 */}
                <button
                  onClick={() => handleDelete(f.file_name)}
                  style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 12, background: 'rgba(220,53,69,0.1)', border: '1px solid #dc3545', borderRadius: 4, padding: '2px 6px', color: '#dc3545' }}
                >삭제</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default UserFileManager;
