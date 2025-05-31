import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';

const baseUrl = 'http://175.116.3.178:8000';

// 모달 컴포넌트: 현재 Redux store에 존재하는 오디오 그룹(트랙 그룹)을 버튼으로 보여줌
const AudioTrackSelectorModal = ({ audioFileInfo, onSelect, onCancel }) => {
  const audioGroups = useSelector(state => state.audioTracks);
  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div style={{ background: '#fff', padding: '20px', borderRadius: '5px', maxWidth: '400px', width: '100%' }}>
        <h3>Select Audio Track Group</h3>
        {audioGroups.length > 0 ? (
          audioGroups.map(group => (
            <button
              key={group.id}
              onClick={() => onSelect(group.id)}
              style={{ display: 'block', margin: '10px 0', width: '100%' }}
            >
              Group {group.id} (Volume: {group.volume})
            </button>
          ))
        ) : (
          <p>No audio track groups available.</p>
        )}
        <button onClick={onCancel} style={{ marginTop: '10px' }}>Cancel</button>
      </div>
    </div>
  );
};

function FileList() {
  const [fileList, setFileList] = useState(null);
  const [error, setError] = useState(null);
  const [showAudioModal, setShowAudioModal] = useState(false);
  // selectedAudioInfo: { folder, file }
  const [selectedAudioInfo, setSelectedAudioInfo] = useState(null);
  const dispatch = useDispatch();

  useEffect(() => {
    async function fetchFileList() {
      try {
        const response = await axios.get(`${baseUrl}/list-file`);
        setFileList(response.data);
      } catch (err) {
        setError(err.message);
      }
    }
    fetchFileList();
  }, []);

  // 기존의 오디오 파일 URL 구성
  const getAudioFileUrl = (folder, file) => {
    return folder === 'sound_effects' || folder === 'custom_tts'
      ? `${baseUrl}/extracted_audio/${folder}/${file}`
      : `${baseUrl}/extracted_audio/${file}`;
  };

  // "Add Audio File" 버튼 클릭 시, 선택한 파일 정보를 저장하고 모달 열기
  const handleOpenAudioModal = (folder, file) => {
    setSelectedAudioInfo({ folder, file });
    setShowAudioModal(true);
  };

  // 모달에서 그룹을 선택했을 때 처리하는 함수
  const handleSelectGroup = async (groupId) => {
    // 예시: 해당 오디오 파일 정보를 이용해 새로운 오디오 트랙 객체 생성 후 store에 저장
    // 여기서는 파일 URL과 기본 placeholder 값으로 처리합니다.
    const { folder, file } = selectedAudioInfo;
    const fileUrl = getAudioFileUrl(folder, file);
    // (추가로 실제 오디오 파형을 생성하는 로직을 넣을 수 있습니다.)
    // 여기서는 간단하게 placeholder 파형 이미지를 사용합니다.
    const newTrack = {
      id: Date.now(),
      startTime: 0,
      // duration은 여기서는 알 수 없으므로 placeholder 값 (예: 5초)
      duration: 5,
      url: fileUrl,
      waveformImage: "https://via.placeholder.com/100x40?text=Wave",
      delayPx: 0,
      width: 500, // 예: 5초 * 100 = 500px (0.01초당 1px 방식 아님, 여기서는 단순 예시)
    };
    dispatch({
      type: 'ADD_AUDIO_TRACKS',
      payload: {
        trackGroupId: groupId,
        newTracks: [newTrack]
      }
    });
    setShowAudioModal(false);
    setSelectedAudioInfo(null);
  };

  const handleCancelModal = () => {
    setShowAudioModal(false);
    setSelectedAudioInfo(null);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>서버 파일 목록</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {fileList ? (
        <>
          <h2>Uploaded Videos</h2>
          {fileList.uploaded_videos.length > 0 ? (
            <ul>
              {fileList.uploaded_videos.map((file, index) => (
                <li key={index}>
                  <Link to={`/file-details?filename=${encodeURIComponent(file)}`}>
                    {file}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>업로드된 동영상 파일이 없습니다.</p>
          )}
          <h2>Extracted Audio</h2>
          {Object.keys(fileList.extracted_audio).map((folder, index) => (
            <div key={index}>
              <h3>{folder}</h3>
              {fileList.extracted_audio[folder] &&
              fileList.extracted_audio[folder].length > 0 ? (
                <ul>
                  {fileList.extracted_audio[folder].map((file, idx) => {
                    const fileUrl = getAudioFileUrl(folder, file);
                    return (
                      <li key={idx} style={{ marginBottom: '10px' }}>
                        <p>{file}</p>
                        <audio controls style={{ width: '100%' }}>
                          <source src={fileUrl} type="audio/mp3" />
                          Your browser does not support the audio element.
                        </audio>
                        {/* 버튼 추가: 각 오디오 파일 옆에 "Add Audio File" 버튼 */}
                        <button onClick={() => handleOpenAudioModal(folder, file)}>
                          Add Audio File
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>파일이 없습니다.</p>
              )}
            </div>
          ))}
        </>
      ) : (
        <p>불러오는 중...</p>
      )}
      {showAudioModal && selectedAudioInfo && (
        <AudioTrackSelectorModal
          audioFileInfo={selectedAudioInfo}
          onSelect={handleSelectGroup}
          onCancel={handleCancelModal}
        />
      )}
    </div>
  );
}

export default FileList;
