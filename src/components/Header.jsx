import React from 'react';
import { Link } from 'react-router-dom';

function Header() {
  return (
    <header style={{ padding: '10px', backgroundColor: '#eee' }}>
      <nav>
        <Link to="/">홈</Link> |
        <Link to="/signup">회원가입</Link> |
        <Link to="/upload">파일 업로드</Link> |
        <Link to="/stt">대본 추출</Link>  |
        <Link to="/audio">오디오</Link> |
        <Link to="/FileList">파일리스트</Link> |
        <Link to="/userfilemanage">유저파일관리</Link>|{' '}
       <Link  to="/useraudio">오디오</Link> |
       <Link  to="/uservideo">비디오</Link> |
      </nav>
    </header>
  );
}

export default Header;
