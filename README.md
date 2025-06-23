
npm install 로 node_modules 설치 이후
npm run dev 실행
npm run electron:dev 로 실행

http://localhost:3000/ 에 실행



src/  
├── components/  
│ ├── Track/ # 하단 트랙 구성  
│ │ ├── AudioTrack - 오디오 트랙 정의  
│ │ ├── VideoTrack - 비디오 트랙 정의  
│ │ ├── TimeLine - 트랙 상단 타임라인 정의  
│ │ └── Track - 오디오, 비디오, 타임라인 전체를 화면에 표시  
│ │  
│ ├── Viwer/ # 우측 상단 Viewer  
│ │ ├── Viewer_Time - 시간 단위 자막 생성 버전  
│ │ ├── Viewer - 초기 자막 생성 버전  
│ │ └── Viewer2 - 자막 폰트 크기 조절 버전  
│ │  
│ ├── LoginModule - 로그인 모듈  
│ ├── ProjectAddModule - 프로젝트 추가 모듈  
│ └── ProjectList - 프로젝트 리스트  
  
├── pages/ # 좌측 상단 + 초기 페이지  
│ ├── App2 - 파일 업로드 및 프로젝트 목록 보기 (초기 페이지)  
│ ├── audio - 효과음 생성 (현재 미사용)  
│ ├── ProjectInfor - 프로젝트 정보 보기 및 store 저장  
│ ├── Script - 자막 내용 편집  
│ ├── TTS - TTS 파일 생성 (미사용)  
│ ├── TTS2 - TTS 파일 생성 버전 2  
│ ├── TTSModel - TTS 모델 생성  
│ └── UserFilemanage - 사용자 파일 목록 및 드래그 앤 드랍  
  
├── App.js # 전체 라우터 구성  
├── store/ # 상태 저장소 (UI 반응 속도 향상용)  
└── User.js # 로그인 후 편집기 UI 구성  
 구성: 좌상(pages), 우상(viewer), 하단(track)  
 각 영역은 크기 조절 가능  