// LoginModule.jsx
import React, { useState } from 'react';
import { createAxiosInstance } from '../api';

function LoginModule({ onLogin, onLogout, loggedInUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const api = createAxiosInstance();
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      const res = await api.post('/login', formData);
      // 성공 시 부모로 로그인 정보 전달
      onLogin({ token: res.data.token, userId: res.data.user_id });
    } catch (error) {
      alert(error?.response?.data?.detail || '로그인 실패');
    }
  };

  const handleSignup = async () => {
    try {
      const api = createAxiosInstance();
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      await api.post('/signup', formData);
      alert('회원가입 성공! 이제 로그인해주세요.');
    } catch (error) {
      alert(error?.response?.data?.detail || '회원가입 실패');
    }
  };

  return (
    <div style={styles.container}>
      <h3>로그인 정보</h3>
      {loggedInUser ? (
        <div style={styles.loggedInBox}>
          <span>{username} 님</span>
          <button onClick={onLogout}>로그아웃</button>
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
