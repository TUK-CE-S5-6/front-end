import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Home from './pages/App2';

import './App.css';
import './Layout.css';
import UserFileManage from './pages/UserFilemanage';
import ProjectInfor from './pages/ProjectInfor'; // 수정된 상세 페이지 컴포넌트

import User from './User';
import TTS from './pages/TTS';
import TTS2 from './pages/TTS2';
import Script from './pages/Script';
import TTSModel from './pages/TTSModel'; // TTSModel 컴포넌트 추가


function App() {
  // FormData 상태를 App.js에서 관리
  const [formData, setFormData] = useState(new FormData());
  // 상단 영역 및 하단 영역 크기 조절 관련 상태들 (splitter 관련 코드 포함)
  const [topLeftWidth, setTopLeftWidth] = useState(300);
  const [bottomHeight, setBottomHeight] = useState(400);
  const verticalSplitterWidth = 5;
  const horizontalSplitterHeight = 5;
  const topRowRef = useRef(null);
  const containerRef = useRef(null);
  const isDraggingVertical = useRef(false);
  const isDraggingHorizontal = useRef(false);

  // 새로 추가: 슬라이더(전역 재생 시간) 상태
  const [globalTime, setGlobalTime] = useState(0);

  useEffect(() => {
    const handleVerticalMouseMove = (e) => {
      if (!isDraggingVertical.current || !topRowRef.current) return;
      const topRowRect = topRowRef.current.getBoundingClientRect();
      let newWidth = e.clientX - topRowRect.left;
      if (newWidth < 100) newWidth = 100;
      if (newWidth > topRowRect.width - 100 - verticalSplitterWidth) {
        newWidth = topRowRect.width - 100 - verticalSplitterWidth;
      }
      setTopLeftWidth(newWidth);
    };

    const handleVerticalMouseUp = () => {
      isDraggingVertical.current = false;
    };

    window.addEventListener('mousemove', handleVerticalMouseMove);
    window.addEventListener('mouseup', handleVerticalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleVerticalMouseMove);
      window.removeEventListener('mouseup', handleVerticalMouseUp);
    };
  }, []);

  const handleVerticalSplitterMouseDown = () => {
    isDraggingVertical.current = true;
  };

  useEffect(() => {
    const handleHorizontalMouseMove = (e) => {
      if (!isDraggingHorizontal.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      let newBottomHeight = containerRect.bottom - e.clientY;
      if (newBottomHeight < 100) newBottomHeight = 100;
      if (newBottomHeight > containerRect.height - horizontalSplitterHeight - 100) {
        newBottomHeight = containerRect.height - horizontalSplitterHeight - 100;
      }
      setBottomHeight(newBottomHeight);
    };

    const handleHorizontalMouseUp = () => {
      isDraggingHorizontal.current = false;
    };

    window.addEventListener('mousemove', handleHorizontalMouseMove);
    window.addEventListener('mouseup', handleHorizontalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleHorizontalMouseMove);
      window.removeEventListener('mouseup', handleHorizontalMouseUp);
    };
  }, []);

  const handleHorizontalSplitterMouseDown = () => {
    isDraggingHorizontal.current = true;
  };

  // 상단 영역 높이 계산 (하단 영역 높이 + splitter 고려)
  const topHeight = `calc(100vh - ${bottomHeight + horizontalSplitterHeight}px)`;

  return (
    <BrowserRouter>
      {/* 모든 하위 컴포넌트를 DndProvider로 감싸서 react-dnd 컨텍스트를 제공 */}
      <DndProvider backend={HTML5Backend}>


        <Routes>
          <Route path="/" element={<Home />} />
          


          {/* ↓ 중첩 라우트 */}
          <Route path="/editor/:projectId" element={<User />}>
            <Route index element={<ProjectInfor />} />
            <Route path="files" element={<UserFileManage />} />
            <Route path="tts" element={<TTS />} />
            <Route path="tts2" element={<TTS2 />} />
            <Route path="script" element={<Script />} />
            <Route path="TTSModel" element={<TTSModel />} />
          </Route>

          <Route path="*" element={<h2>404 Not Found</h2>} />
        </Routes>

      </DndProvider>
    </BrowserRouter>
  );
}

export default App;
