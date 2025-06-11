
npm install 로 node_modules 설치 이후
npm run dev 실행

http://localhost:3000/ 에 실행


내용    


                        
src
    components
        Track: 하단 
            AudioTrack: 오디오 트랙 정의 
            VideoTrack: 비디오 트랙 정의
            TimeLine: 트랙 상단 타임라인 정의
            Track: 오디오 비디오 타임라인 3가지를 전부 화면에 띄워줌
            
        Viwer: 우측 상단
            Viewer_Time: 시간단위 자막 생성버젼 viewer
            Viewer: 초기 자막 생성 버젼
            Viewer2: 자막 폰트 크기 조절 버젼

        LoginModule: 로그인 모듈
        ProjectAddModule: 프로젝트 추가 모듈
        ProjectList: 프로젝트 리스트

    pages: 좌측 상단 + 초기페이지
        App2: 사용자가 넣을 파일과 작성된 프로젝트들을 보는 초기페이지
        audio: 효과음 생성 초기파일 - 현재 비적용중
        ProjectInfor: 프로젝트의 정보를 보여주고 store을 통해 데이터를 저장
        Script: 자막 내용을 보여줌
        TTS : tts 파일 생성 - 비적용중
        TTS2: tts 파일 생성 ver2
        TTSModel: tts 모델 생성
        UserFilemanage: 유저가 가지고 있는 파일을 보여주고 DND를 통해 드래그앤 드랍 가능

   
    App: 라우트용
    store: UI를 빠르게 보여주기 위하여 데이터를 저장하는 코드들 
    User: 유저가 로그인을 하고 프로잭트 를 선택하여 들어갔을 경우 나타나는 비디오 편집기 UI 좌상(pages),우상(viwer),하단(track) 3가지 영역으로 분리 영역 크기조절 가능
