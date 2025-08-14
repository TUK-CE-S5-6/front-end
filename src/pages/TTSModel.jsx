import React, { useState, useMemo, useEffect, useRef } from 'react';

function CreateVoiceCloneForm() {
  // 폼 상태값
  const [name, setName] = useState('');
  const [files, setFiles] = useState([]);
  const [image, setImage] = useState(null); // ← NEW
  const [removeBackgroundNoise, setRemoveBackgroundNoise] = useState(false);
  const [gender, setGender] = useState('male');
  const [language, setLanguage] = useState('ko');
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (!image) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url); // 메모리 누수 방지
  }, [image]);

  // 고정 필드 너비
  const fieldWidth = '120px';

  const imageInputRef = useRef(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  const onImageDragOver = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!isDraggingImage) setIsDraggingImage(true);
  };
  const onImageDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDraggingImage(false);
  };
  const onImageDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDraggingImage(false);
    const file = Array.from(e.dataTransfer.files || []).find(f => f.type.startsWith('image/'));
    if (file) setImage(file);
  };

  // 미리보기 URL들 (오디오/이미지)
  const audioUrls = useMemo(() => {
    return Array.from(files || []).map(f => URL.createObjectURL(f));
  }, [files]);

  useEffect(() => {
    return () => {
      audioUrls.forEach(u => URL.revokeObjectURL(u));
    };
  }, [audioUrls]);

  const imageUrl = useMemo(() => {
    return image ? URL.createObjectURL(image) : null;
  }, [image]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);
  // 파일 변경 핸들러
  const handleFileChange = (e) => {
    setFiles(e.target.files);
  };

  // 이미지 변경 핸들러 ← NEW
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };
  // 바이트를 사람이 읽기 쉬운 단위로
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return `${val.toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
  };
  const audioInputRef = useRef(null);
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);

  const onAudioDragOver = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!isDraggingAudio) setIsDraggingAudio(true);
  };
  const onAudioDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDraggingAudio(false);
  };
  const onAudioDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDraggingAudio(false);
    const dropped = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('audio/'));
    if (dropped.length) {
      // 기존 선택 + 드롭한 파일 합치기
      setFiles(prev => [...Array.from(prev || []), ...dropped]);
    }
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('name', name);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    if (image) {
      formData.append('image', image); // ← NEW
    }
    formData.append('remove_background_noise', removeBackgroundNoise);
    formData.append('description', null);
    const labelsObj = { gender, lang: language };
    formData.append('labels', JSON.stringify(labelsObj));

    try {
      const response = await fetch('http://175.116.3.178:8001/create-voice-model', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(`Server 상태 ${response.status}`);
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
    <div className="mt-8 md:mt-10">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1) 상단 2-컬럼: (좌) 이미지 / (우) 이름 + 성별·언어 */}
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* (좌) 이미지 */}
          <div className="col-span-5">
            <label className="block text-[#ddd] mb-2">이미지</label>

            {/* 숨겨진 실제 파일 입력 */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />

            {/* 파일 정보 + 드롭존 */}
            <div
              onDragEnter={onImageDragOver}
              onDragOver={onImageDragOver}
              onDragLeave={onImageDragLeave}
              onDrop={onImageDrop}
              className={`relative rounded-xl bg-[#1e1e25] border p-3 transition-colors ${isDraggingImage ? 'border-[#5a63ff]' : 'border-[#2b2b36]'
                }`}
            >
              <div className="flex items-center text-xs text-[#9ca3af] mb-2">
                {image && <span className="mr-2">{formatBytes(image.size)}</span>}
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="ml-auto rounded-md bg-[#2b2b36] hover:bg-[#1d1d38] px-3 py-1.5 text-xs font-medium text-white"
                  aria-label="이미지 파일 선택"
                >
                  파일 선택
                </button>
              </div>


              {imagePreview ? (
                <div className="space-y-3 py-2">
                  {/* ✅ 실제 이미지 미리보기 */}
                  <img
                    src={imagePreview}
                    alt="선택한 이미지 미리보기"
                    className="w-full aspect-square object-cover rounded-md border border-[#2b2b36]"
                  />

                  
                </div>
              ) : (
                <div
                  className={`border rounded-lg p-6 text-center ${isDraggingImage ? 'border-[#5a63ff]' : 'border-dashed border-[#2b2b36]'} flex items-center justify-center`}
                  onClick={() => imageInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && imageInputRef.current?.click()}
                  title="여기를 클릭하거나 이미지를 드래그하여 업로드"
                >
                  <i className="fi fi-rs-add-document text-4xl text-[#8a8fa3] pointer-events-none select-none" />
                  <span className="sr-only">이미지를 드래그하거나 파일 선택 버튼을 클릭하세요.</span>
                </div>

              )}

            </div>
          </div>

          {/* (우) 이름 + (아래줄) 성별/언어 */}
          <div className="col-span-7 flex flex-col gap-4">
            {/* 이름 */}
            <div>
              <label className="text-[#ddd]">이름</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full md:w-2/3 rounded-md border border-[#40404f] bg-transparent px-3 py-2 text-white focus:outline-none"
                placeholder="모델 이름을 입력하세요"
              />
            </div>

            {/* 성별 + 언어 (한 줄) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[#ddd]">성별</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="h-10 rounded-xl bg-[#2b2b36] border border-[#2c2c35] px-3 text-sm font-bold text-white hover:bg-[#21212b] focus:outline-none focus:ring-2 focus:ring-[#5a63ff]"
                >
                  <option className="dark-native-option" value="male">남성</option>
                  <option className="dark-native-option" value="female">여성</option>
                  <option className="dark-native-option" value="other">기타</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[#ddd]">언어</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="h-10 rounded-xl bg-[#2b2b36] border border-[#2c2c35] px-3 text-sm font-bold text-white hover:bg-[#21212b] focus:outline-none focus:ring-2 focus:ring-[#5a63ff]"
                >
                  <option className="dark-native-option" value="ko">한국어</option>
                  <option className="dark-native-option" value="en">English</option>
                  <option className="dark-native-option" value="ja">日本語</option>
                  <option className="dark-native-option" value="zh">中文</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ───────── 구분선 ───────── */}

        {/* 2) 음성 샘플 업로드 (단일 섹션) */}
        <div className="flex flex-col gap-2">
          <label className="text-[#ddd]">음성 샘플 업로드 (필수, 10MB 제한)</label>

          {/* 숨겨진 실제 파일 입력 */}
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {/* 파일 정보 + 드롭존 */}
          <div
            onDragEnter={onAudioDragOver}
            onDragOver={onAudioDragOver}
            onDragLeave={onAudioDragLeave}
            onDrop={onAudioDrop}
            className={`relative rounded-xl bg-[#1e1e25] border p-3 transition-colors ${isDraggingAudio ? 'border-[#5a63ff]' : 'border-[#2b2b36]'
              }`}
          >
            <div className="flex items-center text-xs text-[#9ca3af] mb-2">
              {files && Array.from(files).length > 0 && (
                <span className="mr-2">
                  총 {Array.from(files).length}개 · {formatBytes(Array.from(files).reduce((s, f) => s + f.size, 0))}
                </span>
              )}
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="ml-auto rounded-md bg-[#2b2b36] hover:bg-[#1d1d38] px-3 py-1.5 text-xs font-medium text-white"
                aria-label="오디오 파일 선택"
              >
                파일 선택
              </button>
            </div>


            {files && Array.from(files).length > 0 ? (
              <ul className="divide-y divide-[#2b2b36]">
                {Array.from(files).map((f, idx) => {
                  const tooBig = f.size > 10 * 1024 * 1024;
                  return (
                    <li key={idx} className="py-2 flex items-center gap-3">
                      <svg width="20" height="20" viewBox="0 0 24 24" className="text-[#c9c9d4] shrink-0">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M14 2v6h6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate" title={f.name}>{f.name}</div>
                        <div className={`text-xs ${tooBig ? 'text-red-400' : 'text-[#9ca3af]'}`}>
                          {formatBytes(f.size)} · {f.type || 'audio/*'}{tooBig && ' · 10MB 초과'}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div
                className={`border rounded-lg p-6 text-center ${isDraggingAudio ? 'border-[#5a63ff]' : 'border-dashed border-[#2b2b36]'} flex items-center justify-center`}
                onClick={() => audioInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && audioInputRef.current?.click()}
                title="여기를 클릭하거나 오디오 파일을 드래그하여 업로드"
              >
                <i className="fi fi-rs-add-document text-4xl text-[#8a8fa3] pointer-events-none select-none" />
                <span className="sr-only">오디오 파일을 드래그하거나 파일 선택 버튼을 클릭하세요.</span>
              </div>

            )}
          </div>
        </div>

        {/* ───────── 구분선 ───────── */}
        <div className="border-t border-[#2b2b36]" />
 {/* 3) 하단: (좌) 생성 완료 표시 / (우) 제출 */}
 <div className="flex items-center justify-between">
   {message ? (
     <div className="text-green-400 text-sm">
       보이스 모델 생성 완료
     </div>
   ) : (
     <div></div> // 메시지 없을 땐 빈 공간
   )}

   <button
     type="submit"
     className="h-10 rounded-full bg-[#2b2b36] px-6 text-sm font-medium text-white hover:bg-[#242447] transition-colors"
   >
     모델 생성
   </button>
 </div>
        

      </form>

    </div>  

  );
}

export default CreateVoiceCloneForm;