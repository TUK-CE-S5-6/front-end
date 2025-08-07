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
      className="relative flex min-h-screen flex-col bg-[#15151e] text-white overflow-x-hidden"
      style={{ fontFamily: '"Plus Jakarta Sans","Noto Sans",sans-serif' }}
    >
      {/* ─ 헤더 ───────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-[#2c2c35] px-10 py-3">


        {/* 오른쪽: 검색·필터·업로드 */}
        <div className="flex gap-3">
          {/* 검색 */}
          <label className="flex h-10 w-60">
            <div className="flex flex-1 items-stretch rounded-xl bg-[#2c2c35]">
              <div className="flex items-center px-3 text-[#a2a2b3]">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M229.66 218.34 179.6 168.28a88.11 88.11 0 1 0-11.31 11.31l50.06 50.07a8 8 0 0 0 11.32-11.32ZM40 112a72 72 0 1 1 72 72 72.08 72.08 0 0 1-72-72Z" />
                </svg>
              </div>
              <input
                placeholder="검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 rounded-r-xl bg-[#2c2c35] px-2 placeholder-[#a2a2b3] focus:outline-none"
              />
            </div>
          </label>

          {/* 필터 토글 */}
          <div className="relative">
            <button
              ref={filterBtnRef}
              onClick={() => setShowFilterMenu((m) => !m)}
              className="h-10 rounded-xl bg-[#2b2b36] hover:bg-[#21212b] px-4 text-sm font-bold transition-colors"
            >
              필터 ▾
            </button>

            {/* 드롭다운 */}
            {showFilterMenu && (
              <ul
                className="absolute right-0 mt-1 w-32 overflow-hidden rounded-xl border border-[#2c2c35] bg-[#0c0c26] text-sm"
              >
                {filterOptions.map((opt) => (
                  <li key={opt.value}>
                    <button
                      onClick={() => {
                        setFilterType(opt.value);
                        setShowFilterMenu(false);
                      }}
                      className="block w-full px-4 py-2 text-left hover:bg-[#2c2c35]"
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 업로드 */}
          <button
            className="h-10  bg-[#2b2b36] hover:bg-[#21212b] rounded-xl bg-[#0c0c26] px-4 text-sm font-bold"
            onClick={() => fileInputRef.current.click()}
          >
            업로드
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </header>




      {/* ─ 콘텐츠 ─ */}
      <main className="flex flex-none justify-center px-10 py-6">
        {filtered.length === 0 ? (
          /* 빈 목록일 때 */
          <div className="flex h-[300px] w-full max-w-[960px] items-center justify-center text-[#a2a2b3]">
            파일 없음
          </div>
        ) : (
          /* 파일 카드 목록 */
          <ul
            className="grid justify-start w-full grid-cols-[repeat(auto-fill,_minmax(240px,_1fr))] gap-4"
          >

            {filtered.map((f, idx) => (
              <li
                key={idx}
                draggable
                onDragStart={(e) => handleDragStart(e, f)}
                className="relative w-[240px] min-w-[240px] overflow-hidden rounded-xl bg-[#0c0c26]"
              >

                {/* 썸네일 */}
                {f.thumbnailImage && (
                  <>
                    <img
                      src={f.thumbnailImage}
                      alt={f.file_name}
                      className="aspect-[16/9] w-full object-cover"
                      draggable={false}
                    />
                    {/* 파일명 오버레이 */}
                    <span className="absolute bottom-0 left-0 w-full truncate bg-black/50 px-2 py-1 text-xs">
                      {f.file_name}
                    </span>
                  </>
                )}

                <button
                  aria-label="delete"
                  onClick={() => handleDelete(f.file_name)}
                  className="
                absolute top-[4px] right-[5px] flex h-6 w-6 items-center justify-center
                bg-transparent                       /* 평상시 완전 투명 */
                text-white text-base leading-none    /* ‘X’ 글자 자체만 표시 */
                hover:bg-[#1e1e25]                   /* 호버 시 어두운 배경 */
                transition
                select-none"
                  /* ‘X’ 글자에만 얇은 붉은 테두리를 둘러준다 */
                  style={{
                    WebkitTextStroke: '1px #dc2626',   /* 크롬·사파리 */
                    textStroke: '1px #dc2626',        /* 파이어폭스(실험적) */
                  }}
                >
                  ×
                </button>



              </li>
            ))}
          </ul>
        )}
      </main>





    </div>

  );
};

export default UserFileManager;