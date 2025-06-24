import '../User.css';
// src/pages/UserFileManager.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
/**
 * 2초 간격으로 캡처한 연속 프레임을 이어붙인 썸네일 생성
 * — CORS 없이 fetch→Blob URL 우회 버전
 */
async function generateDragThumbnail(
  videoUrl,
  intervalSec = 2,
  frameW = 120,
  frameH = Math.round((120 * 9) / 16)
) {
  // 1) fetch로 blob 가져오기
  let blobUrl;
  try {
    const resp = await fetch(videoUrl, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    const blob = await resp.blob();
    blobUrl = URL.createObjectURL(blob);
  } catch (err) {
    console.warn('비디오 Blob 우회 실패, 직접 URL 사용:', err);
    blobUrl = videoUrl;
  }

  // 2) 그 blob URL(또는 원본 URL)로 비디오 엘리먼트 생성
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = blobUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      // 메타 로드되면 캔버스 준비
      const duration = video.duration;
      const count = Math.ceil(duration / intervalSec);
      const lastSec = duration - intervalSec * (count - 1);
      const lastW = frameW * (lastSec / intervalSec);
      const canvas = document.createElement('canvas');
      canvas.width = frameW * (count - 1) + lastW;
      canvas.height = frameH;
      const ctx = canvas.getContext('2d');

      let idx = 0;
      video.onseeked = () => {
        const w = idx < count - 1 ? frameW : lastW;
        ctx.drawImage(
          video,
          0,
          0,
          video.videoWidth,
          video.videoHeight,
          idx * frameW,
          0,
          w,
          frameH
        );
        idx++;
        if (idx < count) {
          video.currentTime = Math.min(idx * intervalSec, duration);
        } else {
          // 메모리 누수 방지
          if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
          resolve(canvas.toDataURL('image/png'));
        }
      };

      video.currentTime = 0;
    };

    video.onerror = (e) => {
      reject(new Error(`Drag thumbnail error: ${video.error?.code}`));
    };
  });
}

const BASE_URL = 'http://175.116.3.178:8000';

// user_files → user-files 정규화, BASE_URL 결합
function normalizePath(path) {
  if (path.startsWith('http')) return path;
  const p = path.replace(/^\/?user_files\//, '/user-files/');
  return p.startsWith('/') ? p : '/' + p;
}
function buildUrl(path) {
  const p = normalizePath(path);
  return p.startsWith('http') ? p : `${BASE_URL}${p}`;
}

// 파형 이미지 생성 함수 (url -> dataURL)
async function fetchWaveform(url) {
  // 2) fetch
  const token = localStorage.getItem('authToken');
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      mode: 'cors', // 명시적으로 CORS 모드
      cache: 'no-cache', // 캐시 비활성화
    });
  } catch (networkErr) {
    console.error('fetchWaveform 네트워크 오류:', networkErr);
    throw networkErr;
  }
  if (!res.ok) {
    console.error(
      `fetchWaveform HTTP 에러: ${res.status} ${res.statusText}`,
      url
    );
    throw new Error(`오디오 파일을 불러올 수 없습니다: ${url}`);
  }

  // 3) ArrayBuffer → AudioBuffer
  let arrayBuffer;
  try {
    arrayBuffer = await res.arrayBuffer();
  } catch (bufErr) {
    console.error('arrayBuffer 변환 실패:', bufErr);
    throw bufErr;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  let audioBuf;
  try {
    // 일부 브라우저에서는 콜백 버전을 요구할 수 있음
    audioBuf = await ctx.decodeAudioData(arrayBuffer);
  } catch (decodeErr) {
    console.error('decodeAudioData 실패:', decodeErr);
    ctx.close();
    throw decodeErr;
  }
  ctx.close();

  // 4) 캔버스에 파형 그리기
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
    // 원래 높이에 1.5배 증폭, 캔버스 넘지 않도록 클램핑
    const rawBar = (sum / step) * height * 3;
    const bar = Math.min(rawBar, height);
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

const filterOptions = [
  { value: 'all', label: '전체' },
  { value: 'mp4', label: '비디오' },
  { value: 'mp3', label: '오디오' },
];

const UserFileManager = () => {
  const [files, setFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const filterBtnRef = useRef(null);
  const [menuWidth, setMenuWidth] = useState(0);

  // 확장자 목록: ex) ['mp4','mp3','png',…]
  const extensions = useMemo(
    () =>
      Array.from(
        new Set(files.map((f) => f.file_name.split('.').pop().toLowerCase()))
      ),
    [files]
  );

  const fileInputRef = useRef();
  const token = localStorage.getItem('authToken');
  const getAuthHeaders = () => ({ Authorization: `Bearer ${token}` });

  // 파일 목록 조회 + 메타데이터 로딩
  const fetchFiles = async () => {
    try {
      const res = await fetch(`${BASE_URL}/user-files`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const { files: data } = await res.json();

      // 각 파일마다 duration과 (오디오이면) waveformImage까지 미리 계산
      const processed = await Promise.all(
        data.map(async (f) => {
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
            await new Promise((res) => (media.onloadedmetadata = res));
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
            duration, // 미리 계산된 길이
            thumbnailImage,
            waveformImage, // 오디오만 있을 것
          };
        })
      );

      setFiles(processed);
    } catch (err) {
      console.error('파일 조회 실패', err);
    }
  };

  useEffect(() => {
    if (showFilterMenu && filterBtnRef.current) {
      setMenuWidth(filterBtnRef.current.getBoundingClientRect().width);
    }
  }, [showFilterMenu]);

  useEffect(() => {
    fetchFiles();
    const timer = setInterval(fetchFiles, 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    // files 중에서 video이고 dragThumbnail이 없는 항목만 처리
    files.forEach((f, idx) => {
      if (f.file_type === 'video' && !f.VideoThumbnailImage) {
        generateDragThumbnail(f.file_url)
          .then((img) => {
            // 생성된 썸네일을 해당 인덱스에 반영
            setFiles((prev) => {
              const next = [...prev];
              next[idx] = { ...next[idx], VideoThumbnailImage: img };
              return next;
            });
          })
          .catch((err) => {
            console.warn('드래그용 썸네일 생성 실패:', f.file_name, err);
          });
      }
    });
  }, [files]);

  // 파일 업로드
  const handleFileChange = async (e) => {
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
  const handleDelete = async (name) => {
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
    .filter((f) => {
      if (filterType === 'all') return true;
      // mp4는 비디오, mp3는 오디오
      return f.file_name.toLowerCase().endsWith(`.${filterType}`);
    })
    .filter((f) =>
      f.file_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // 드래그 시작 핸들러

  // 이제 handleDragStart는 async가 아니어야 합니다!
  const handleDragStart = (e, file) => {
    // 1) 파일명
    console.log('📁 Dragging file:', file.file_name);
    // 2) 처리된 URL
    console.log('🔗 file_url:', file.file_url);
    // 3) 생성된 썸네일 URL
    console.log('🖼 thumbnailImage:', file.VideoThumbnailImage);
    const payload = {
      url: file.file_url,
      thumbnailUrl: file.VideoThumbnailImage, // ← 여기를 file.thumbnailImage 로
      fileName: file.file_name,
      fileType: file.file_type,
      duration: file.duration,
      waveformImage: file.waveformImage,
    };

    console.log('Drag Start Payload:', payload);
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
  };

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 800,
        margin: '0 auto',
        height: '100%', // ✅ 부모 영역을 꽉 채움
        overflow: 'hidden', // ✅ 전체 스크롤 막기
        boxSizing: 'border-box', // ✅ 패딩 포함한 전체 높이 계산
        paddingBottom: '200px', // [추가] 아래에 200px 빈 공간 확보

      }}
    >
      <h1>📁파일 관리</h1>

      {/* 검색 + 필터 + 업로드 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <input
          placeholder="검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, padding: 4 }}
        />
        <div style={{ position: 'relative' }}>
          <button
            ref={filterBtnRef}
            onClick={() => setShowFilterMenu((m) => !m)}
            className="upload-button"
          >
            필터 ▾
          </button>
          {showFilterMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%', // 버튼 바로 아래
                right: 0,
                marginTop: 4,
                width: menuWidth, // 버튼과 동일 너비
                background: '#fff',
                border: '1px solid #000',
                borderRadius: 4,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 1000,
              }}
            >
              {filterOptions.map((opt, i) => (
                <button
                  key={opt.value}
                  className="upload-button" // 토글 버튼과 동일 스타일
                  onClick={() => {
                    setFilterType(opt.value);
                    setShowFilterMenu(false);
                  }}
                  style={{
                    width: '100%',
                    borderRadius: 0, // 모서리 둥글기 제거
                    borderBottom:
                      i < filterOptions.length - 1
                        ? '1px solid rgba(255,255,255,0.5)' // 마지막 제외 구분선
                        : 'none',
                    textAlign: 'left',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="upload-button"
          onClick={() => fileInputRef.current.click()}
        >
          업로드
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* 파일 목록: 고정 크기 그리드 */}
      {filtered.length === 0 ? (
        <p>파일 없음</p>
      ) : (
        <div className="file-list-scroll">
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, 150px)',
              gap: 8,
              justifyContent: 'center',
            }}
          >
            {filtered.map((f, i) => (
              <li
                key={i}
                draggable
                onDragStart={(e) => handleDragStart(e, f)}
                style={{
                  position: 'relative',
                  border: '1px solid #ccc',
                  padding: 8,
                  cursor: 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* 썸네일 */}
                {f.thumbnailImage && (
                  <img
                    src={f.thumbnailImage}
                    alt={f.file_name}
                    style={{
                      width: '100%',
                      aspectRatio: '1/1',
                      objectFit: 'cover',
                      marginBottom: 8,
                      borderRadius: 4,
                    }}
                    draggable={false}
                  />
                )}
                {/* 파일명 */}
                <strong
                  style={{
                    fontSize: 14,
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    marginBottom: 24,
                  }}
                >
                  {f.file_name}
                </strong>
                {/* 삭제 버튼 */}
                <button
                  onClick={() => handleDelete(f.file_name)}
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    fontSize: 12,
                    background: 'rgba(220,53,69,0.1)',
                    border: '1px solid #dc3545',
                    borderRadius: 4,
                    padding: '2px 6px',
                    color: '#dc3545',
                  }}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default UserFileManager;