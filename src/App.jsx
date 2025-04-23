import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Home from './pages/App2';
import SignUp from './pages/SignUp';
import Header from './components/Header';
import Upload from './pages/Upload';
import Stt from './pages/SttVideo';
import AudioGenerator from './pages/audio';
import './App.css';
import './Layout.css';
import Track from './components/Track/Track';
import Viewer from './components/Viewer/Viewer';
import FileDetails from './pages/file-details';
import FileList from './pages/FileList';
import UserFileManage from './pages/UserFilemanage';
import ProjectInfor from './pages/ProjectInfor'; // 수정된 상세 페이지 컴포넌트
import UserAudio from './pages/UserAudio';
import UserVideo from './pages/UserVideo'; 

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
        <Header />
        <div
          className="container"
          ref={containerRef}
          style={{
            gridTemplateRows: `${topHeight} ${horizontalSplitterHeight}px ${bottomHeight}px`
          }}
        >
          {/* 상단 영역: 좌측은 라우팅 페이지, 우측은 VideoViewer */}
          <div
            className="topRow"
            ref={topRowRef}
            style={{ gridColumn: '1 / span 2', display: 'flex', gap: '10px' }}
          >
            <div
              className="topLeft"
              style={{
                width: `${topLeftWidth}px`,
                backgroundColor: 'lightblue'
              }}
            >
              <Routes>
                <Route path="/editor/:projectId" element={<ProjectInfor />} />
                <Route path="/" element={<Home />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/stt" element={<Stt />} />
                <Route path="/audio" element={<AudioGenerator />} />
                <Route path="/file-details" element={<FileDetails />} />
                <Route path="/filelist" element={<FileList />} />
                <Route path="/userfilemanage" element={<UserFileManage />} />
                <Route path="/useraudio" element={<UserAudio />} />
                <Route path="/uservideo" element={<UserVideo />} />
                <Route path="*" element={<h2>404 Not Found</h2>} />
              </Routes>
            </div>
            {/* Vertical splitter */}
            <div
              className="vertical-splitter"
              onMouseDown={handleVerticalSplitterMouseDown}
              style={{
                width: `${verticalSplitterWidth}px`,
                backgroundColor: '#ccc',
                cursor: 'col-resize'
              }}
            ></div>
            <div className="topRight" style={{ flexGrow: 1, backgroundColor: 'lightcoral' }}>
              {/* 비디오 뷰어 */}
              <Viewer />
            </div>
          </div>
          {/* Horizontal splitter */}
          <div
            className="horizontal-splitter"
            onMouseDown={handleHorizontalSplitterMouseDown}
            style={{
              gridColumn: '1 / span 2',
              backgroundColor: '#ccc',
              cursor: 'row-resize'
            }}
          ></div>
          {/* 하단 영역: Track 컴포넌트 */}
          <div className="bottom" style={{ gridColumn: '1 / span 2' }}>
            <Track />
          </div>
        </div>
      </DndProvider>
    </BrowserRouter>
  );
}

export default App;
