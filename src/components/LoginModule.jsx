import React, { useState, useEffect } from 'react';
import { createAxiosInstance } from '../api';

function LoginModule({ onLogin, onLogout, loggedInUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // ✅ 자동 로그인 처리
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    const savedUsername = localStorage.getItem('username');
    console.log(
      '[AutoLogin] token:',
      token,
      'userId:',
      userId,
      'username:',
      savedUsername
    );

    if (token && userId) {
      setUsername(savedUsername || '');
      if (!loggedInUser) {
        console.log('[AutoLogin] Triggering onLogin');
        onLogin({ token, userId: parseInt(userId) });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    try {
      const api = createAxiosInstance();
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      console.log('[Login] Attempting login with username:', username);
      const res = await api.post('/login', formData);

      const token = res.data.token;
      const userId = res.data.user_id;

      console.log('[Login] Login successful. userId:', userId, 'token:', token);

      localStorage.setItem('authToken', token);
      localStorage.setItem('userId', userId);
      localStorage.setItem('username', username);

      onLogin({ token, userId });
    } catch (error) {
      console.error('[Login] Login failed:', error);
      alert(error?.response?.data?.detail || '로그인 실패');
    }
  };

  const handleSignup = async () => {
    try {
      const api = createAxiosInstance();
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      console.log('[Signup] Attempting signup with username:', username);
      await api.post('/signup', formData);
      alert('회원가입 성공! 이제 로그인해주세요.');
    } catch (error) {
      console.error('[Signup] Signup failed:', error);
      alert(error?.response?.data?.detail || '회원가입 실패');
    }
  };

  const handleLogoutClick = () => {
    console.log('[Logout] Logging out');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    onLogout();
    setUsername('');
    setPassword('');
  };

  return (
    <div style={styles.container}>
      <h3>로그인 정보</h3>
      {loggedInUser ? (
        <div style={styles.loggedInBox}>
          <span>{username} 님</span>
          <button onClick={handleLogoutClick}>로그아웃</button>
        </div>
      ) : (
        <div style={styles.loginBox}>
          <input
            type="text"
            placeholder="USERID"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="PASSWORD"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div style={styles.buttonRow}>
            <button onClick={handleSignup}>회원가입</button>
            <button onClick={handleLogin}>로그인</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    border: '1px solid #999',
    padding: '12px',
    backgroundColor: '#eee',
    flexShrink: 0,
  },
  loginBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  loggedInBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  buttonRow: {
    display: 'flex',
    gap: '8px',
  },
};

export default LoginModule;
