import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Home from './pages/App2';

import './App.css';
import './Layout.css';
import UserFileManage from './pages/UserFilemanage';
import Audio from './pages/audio'; // 수정된 상세 페이지 컴포넌트

import User from './User';
import TTS from './pages/TTS';
import TTS2 from './pages/TTS2';
import Script from './pages/Script';
import TTSModel from './pages/TTSModel'; // TTSModel 컴포넌트 추가


function App() {
  // FormData 상태를 App.js에서 관리



  // 상단 영역 높이 계산 (하단 영역 높이 + splitter 고려)

  return (
    <BrowserRouter>
      {/* 모든 하위 컴포넌트를 DndProvider로 감싸서 react-dnd 컨텍스트를 제공 */}
      <DndProvider backend={HTML5Backend}>


        <Routes>
          <Route path="/" element={<Home />} />
          {/* ↓ 중첩 라우트 */}
          <Route path="/editor/:projectId" element={<User />}>
            <Route index element={<UserFileManage />} />
            <Route path="files" element={<UserFileManage />} />
            <Route path="tts" element={<TTS />} />
            <Route path="tts2" element={<TTS2 />} />
            <Route path="script" element={<Script />} />
            <Route path="TTSModel" element={<TTSModel />} />
            <Route path="Audio" element={<Audio />} />

          </Route>

          <Route path="*" element={<h2>404 Not Found</h2>} />



        </Routes>

      </DndProvider>
    </BrowserRouter>
  );
}

export default App;
