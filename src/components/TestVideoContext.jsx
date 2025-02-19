// TestVideoContext.jsx
import React, { useContext, useEffect } from 'react';
import { VideoContext } from '../components/VideoContext'; // 실제 경로에 맞게 수정하세요

const TestVideoContext = () => {
  const {
    videoData,
    videoURL,
    audioURL,
    currentTime,
    duration,
    videoRef,
  } = useContext(VideoContext);

  useEffect(() => {
    console.log("=== VideoContext 값들 ===");
    console.log("videoData:", videoData);
    console.log("videoURL:", videoURL);
    console.log("audioURL:", audioURL);
    console.log("currentTime:", currentTime);
    console.log("duration:", duration);
    console.log("videoRef:", videoRef);
  }, [videoData, videoURL, audioURL, currentTime, duration, videoRef]);

  return (
    <div>
      <h2>VideoContext Test Component</h2>
      <p>콘솔을 확인하여 VideoContext의 모든 정보를 확인하세요.</p>
    </div>
  );
};

export default TestVideoContext;