import React, { useState } from 'react';

function AuthPage() {
  const [mode, setMode] = useState('login'); // "login" 또는 "signup"
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint =
      mode === 'login'
        ? 'http://175.116.3.178:8000/login'
        : 'http://175.116.3.178:8000/signup';

    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.detail || '에러 발생');
      } else {
        setMessage(data.message);
        setUserId(data.user_id);
        setUsername('');
        setPassword('');

        // 토큰 저장 (서버가 token을 응답 본문에 포함하도록 설정되어 있어야 함)
        if (data.token) {
          localStorage.setItem('authToken', data.token);
        }
      }
    } catch (error) {
      setMessage('네트워크 에러');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <h2>{mode === 'login' ? '로그인' : '회원가입'}</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block' }}>아이디:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block' }}>비밀번호:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <button type="submit" style={{ padding: '10px 20px' }}>
          {mode === 'login' ? '로그인' : '회원가입'}
        </button>
      </form>
      {message && <p style={{ marginTop: '10px' }}>{message}</p>}
      {userId && (
        <p style={{ marginTop: '10px' }}>
          현재 사용자 ID: <strong>{userId}</strong>
        </p>
      )}
      <div style={{ marginTop: '20px' }}>
        {mode === 'login' ? (
          <p>
            계정이 없으신가요?{' '}
            <button
              onClick={() => {
                setMode('signup');
                setMessage('');
              }}
            >
              회원가입 하기
            </button>
          </p>
        ) : (
          <p>
            이미 계정이 있으신가요?{' '}
            <button
              onClick={() => {
                setMode('login');
                setMessage('');
              }}
            >
              로그인 하기
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default AuthPage;
