import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';


import './App.css';
import './Layout.css';
import Track from './components/Track/Track';
import Viewer from './components/Viewer/Viewer_Time';


function User() {
  // FormData 상태를 App.js에서 관리

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
          gridTemplateRows: `${topHeight} ${horizontalSplitterHeight}px ${bottomHeight}px`,
          backgroundColor: '#2b2d31', // 전체 배경
          color: '#f2f3f5',            // 전체 텍스트 색상
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
              display: 'flex', // ✅ 좌우 나누기 위해 flex
              backgroundColor: '#313338',
              color: '#f2f3f5'
            }}
          >
            <nav
              style={{
                padding: '8px',
                borderRight: '1px solid #ccc',
                display: 'flex',
                flexDirection: 'column',  // 세로 정렬
                gap: '8px',
                minWidth: '120px',
                backgroundColor: '#313338',
                height: '100%',
              }}
            >
              <NavLink
                to=""
                end
                style={({ isActive }) => ({
                  fontWeight: isActive ? 'bold' : 'normal',
                  color: isActive ? '#5865f2' : '#f2f3f5',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  backgroundColor: isActive ? '#404249' : 'transparent'
                })}
              >
                Info
              </NavLink>

              <NavLink
                to="files"
                end
                style={({ isActive }) => ({
                  fontWeight: isActive ? 'bold' : 'normal',
                  color: isActive ? '#5865f2' : '#f2f3f5',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  backgroundColor: isActive ? '#404249' : 'transparent'
                })}
              >
                Files
              </NavLink>

              <NavLink
                to="tts2"
                end
                style={({ isActive }) => ({
                  fontWeight: isActive ? 'bold' : 'normal',
                  color: isActive ? '#5865f2' : '#f2f3f5',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  backgroundColor: isActive ? '#404249' : 'transparent'
                })}
              >
                tts
              </NavLink>

              <NavLink
                to="script"
                end
                style={({ isActive }) => ({
                  fontWeight: isActive ? 'bold' : 'normal',
                  color: isActive ? '#5865f2' : '#f2f3f5',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  backgroundColor: isActive ? '#404249' : 'transparent'
                })}
              >
                script
              </NavLink>

              <NavLink
                to="TTSModel"
                end
                style={({ isActive }) => ({
                  fontWeight: isActive ? 'bold' : 'normal',
                  color: isActive ? '#5865f2' : '#f2f3f5',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  backgroundColor: isActive ? '#404249' : 'transparent'
                })}
              >
                TTSModel
              </NavLink>
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
              backgroundColor: '#404249', // splitter 색상
              cursor: 'col-resize'
            }}
          ></div>
          <div className="topRight" style={{
            flexGrow: 1,
            backgroundColor: '#2b2d31', // Viewer 배경
            color: '#f2f3f5'
          }}>
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
            backgroundColor: '#404249', // splitter 색상
            cursor: 'row-resize',
            padding: 0,
            margin: 0,
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
