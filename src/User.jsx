import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';

import Header from './components/Header';

import './App.css';
import './Layout.css';
import Track from './components/Track/Track';
import Viewer from './components/Viewer/Viewer_Time';


function User() {
  // FormData 상태를 App.js에서 관리
  const [formData, setFormData] = useState(new FormData());
  const [activeView, setActiveView] = useState('project'); // 기본적으로 Project Info 뷰를 활성화
  // URL 파라미터에서 projectId를 가져옵니다
  const { projectId } = useParams();
  // 상단 영역 및 하단 영역 크기 조절 관련 상태들 (splitter 관련 코드 포함)
  const [topLeftWidth, setTopLeftWidth] = useState(700);
  const [bottomHeight, setBottomHeight] = useState(300);
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
    <div>
      <div
        className="container"
        ref={containerRef}
        style={{
          gridTemplateRows: `${topHeight} ${horizontalSplitterHeight}px ${bottomHeight}px`
        }}
      >
        {/* 상단 영역: 좌측은 여러 페이지, 우측은 VideoViewer */}
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
            <nav style={{ padding: '8px', borderBottom: '1px solid #ccc', display: 'flex', gap: '4px' }}>
              <NavLink to="" end style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}>Info</NavLink>
              <NavLink to="files" style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}>Files</NavLink>
              <NavLink to="tts2" style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}>tts</NavLink>
              <NavLink to="script" style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}>script</NavLink> 
              <NavLink to="TTSModel" style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}>TTSModel</NavLink> 
            </nav>

            {/* 중첩 라우트의 컴포넌트를 여기에 렌더링 */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Outlet context={{ projectId }} />
            </div>


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
    </div>
  );
}

export default User;
