// App.jsx
import React, { useState } from 'react';
import LoginModule from '../components/LoginModule';
import ProjectAddModule from '../components/ProjectAddModule';
import ProjectList from '../components/ProjectList';

function App() {
  const [authInfo, setAuthInfo] = useState(null);

  const handleLogin = (data) => {
    setAuthInfo(data);
  };

  const handleLogout = () => {
    setAuthInfo(null);
  };

  const handleProjectClick = (projectId, data) => {
    console.log('Project clicked:', projectId, data);
    // 이후 상세 편집 모달 띄우거나 페이지 이동
  };

  const handleProjectAdded = () => {
    // 프로젝트 추가 후 처리(리스트 새로 고침 등) → ProjectList에서 useEffect가 다시 호출됨
  };

  return (
    <div style={styles.appContainer}>
      {/* 왼쪽 영역 (로그인 모듈 + 프로젝트 추가 모듈) */}
      <div style={styles.leftContainer}>
        <div style={styles.loginBox}>
          <LoginModule
            loggedInUser={authInfo}
            onLogin={handleLogin}
            onLogout={handleLogout}
          />
        </div>
        <div style={styles.projectAddBox}>
          <ProjectAddModule
            token={authInfo?.token}
            onProjectAdded={handleProjectAdded}
          />
        </div>
      </div>

      {/* 오른쪽 영역 (프로젝트 조회 모듈) */}
      <div style={styles.rightContainer}>
        <ProjectList
          token={authInfo?.token || null}
          onProjectClick={handleProjectClick}
        />
      </div>
    </div>
  );
}

const styles = {
  appContainer: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#ccc', // 전체 배경 회색
  },
  leftContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '300px', // 왼쪽 너비
    gap: '8px',
    padding: '8px',
    backgroundColor: '#bbb',
  },
  loginBox: {
    // 로그인 모듈 칸
    flexShrink: 0,
  },
  projectAddBox: {
    // 프로젝트 추가 모듈 칸
    flexGrow: 1,
    marginTop: '8px',
  },
  rightContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    // 프로젝트 리스트 영역
  },
};

export default App;
