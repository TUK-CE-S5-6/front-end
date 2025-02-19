import React, { createContext, useState, useRef } from 'react';

// Context 생성
export const VideoContext = createContext();

// Provider 컴포넌트 정의
export const VideoProvider = ({ children }) => {
  // 미리보기 재생용 비디오 정보
  const [videoURL, setVideoURL] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);

  // 업로드된 JSON 데이터를 배열로 저장
  const [uploadedVideos, setUploadedVideos] = useState([]);
  // 단일 업로드 결과를 저장 (필요시 사용)
  const [videoData, setVideoData] = useState(null);
  // background_music URL 저장용
  const [audioURL, setAudioURL] = useState(null);

  // JSON 데이터를 배열에 추가하는 함수 (VideoUpload.jsx 등에서 사용)
  const addVideoData = (uploadData) => {
    setUploadedVideos((prevUploads) => [...prevUploads, uploadData]);
  };

  return (
    <VideoContext.Provider
      value={{
        // 미리보기 재생용 정보
        videoURL,
        setVideoURL,
        currentTime,
        setCurrentTime,
        duration,
        setDuration,
        videoRef,
        // 업로드된 JSON 데이터 및 관련 상태
        uploadedVideos,
        addVideoData,
        videoData,
        setVideoData,
        audioURL,
        setAudioURL,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
};

export default VideoProvider;
