// App.js
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SignUp from './pages/SignUp';
import Header from './components/Header';
import Upload from './pages/Upload';
import Stt from './pages/SttVideo';
import './App.css';  // 예: 여기에 container, topLeft, topRight, bottom 등 grid CSS
import './Layout.css';
import VideoViewer from './components/VideoViewer';
import Track from './components/Track';
import Asd from './components/asd';
import { VideoProvider } from './components/VideoContext';
import Video_Track from './components/Video_Track';
import CombinedTrack from './components/CombinedTrack';
import VideoTimelinePreview from './components/VideoTimelinePreview';
import TestVideoContext from './components/TestVideoContext';
function App() {
  

  return (
    // VideoProvider로 전체 앱을 감싸면 VideoContext를 사용하는 모든 컴포넌트에서 접근할 수 있습니다.
    <VideoProvider>
      <BrowserRouter>
        <Header />
        <div className="container">
          {/* 왼쪽 상단 영역 */}
          <div className="topLeft">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/stt" element={<Stt />} />
              <Route path="*" element={<h2>404 Not Found</h2>} />
            </Routes>
          </div>

          {/* 오른쪽 상단 영역 */}
          <div className="topRight">
            <VideoViewer />       
          </div>

          {/* 하단 영역 */}
          <div className="bottom">
            <CombinedTrack />
            
          </div>
          
        </div>
      </BrowserRouter>
    </VideoProvider>
  );
}

export default App;
