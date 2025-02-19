// CombinedTrack.jsx
import React, { useState, useRef, useEffect, useContext } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { VideoContext } from './VideoContext';
import VideoPlaybackControl from './VideoPlaybackControl';

// =======================
// 스타일 정의 (생략)
// =======================
const commonContainerStyle = {
  width: '2200px',
  overflowX: 'auto'
};

const timelineContainerStyle = {
  width: '2200px',
  height: '30px',
  paddingTop: '20px',
  borderBottom: '1px solid #000',
  backgroundColor: '#f7f7f7',
  position: 'sticky',
  top: 0,
  zIndex: 200
};

const mintBoxStyle = {
  minWidth: '30000px',
  height: '60px',
  backgroundColor: '#AAF0D1'
};

const blueBoxStyle = {
  minWidth: '30000px',
  height: '60px',
  backgroundColor: '#00aaff',
  position: 'relative'
};

const redBoxStyle = {
  minWidth: '30000px',
  height: '100px', // 비디오 트랙 영역 높이
  backgroundColor: '#ffcccc',
  position: 'relative'
};

const draggableItemStyle = {
  position: 'absolute',
  top: '0px',
  height: '40px',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  border: '1px solid #000',
  textAlign: 'center',
  lineHeight: '40px',
  cursor: 'grab',
  zIndex: 10
};

// =======================
// 타임라인 헬퍼 함수들
// =======================
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

const renderTimelineComponent = (duration) => {
  const ticks = [];
  const totalSec = Math.floor(duration);
  for (let i = 0; i <= totalSec; i++) {
    const leftPos = i * 50;
    const isBigTick = i % 5 === 0;
    const tickHeight = isBigTick ? 15 : 8;
    const tickWidth = isBigTick ? '2px' : '1px';
    ticks.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${leftPos}px`,
          bottom: '0px',
          width: tickWidth,
          height: `${tickHeight}px`,
          backgroundColor: '#000'
        }}
      >
        {isBigTick && (
          <span
            style={{
              position: 'absolute',
              top: '-20px',
              left: '-20px',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
          >
            {formatTime(i)}
          </span>
        )}
      </div>
    );
  }
  return ticks;
};

// =======================
// 오디오 관련 헬퍼 함수들 (기존 코드 유지)
// =======================
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function encodeWAV(samples, sampleRate, numChannels, bitDepth) {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);
  floatTo16BitPCM(view, 44, samples);
  return buffer;
}

function audioBufferToWav(buffer, opt) {
  opt = opt || {};
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = opt.float32 ? 3 : 1;
  const bitDepth = format === 3 ? 32 : 16;
  let samples;
  if (numChannels === 2) {
    const channelData0 = buffer.getChannelData(0);
    const channelData1 = buffer.getChannelData(1);
    const length = channelData0.length + channelData1.length;
    samples = new Float32Array(length);
    let index = 0;
    for (let i = 0; i < channelData0.length; i++) {
      samples[index++] = channelData0[i];
      samples[index++] = channelData1[i];
    }
  } else {
    samples = buffer.getChannelData(0);
  }
  return encodeWAV(samples, sampleRate, numChannels, bitDepth);
}

function generateWaveformImage(audioBuffer, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ddd';
  ctx.fillRect(0, 0, width, height);
  const data = audioBuffer.getChannelData(0);
  const step = Math.floor(data.length / width);
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    for (let j = 0; j < step; j++) {
      const datum = data[i * step + j];
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    const y1 = (1 + min) * 0.5 * height;
    const y2 = (1 + max) * 0.5 * height;
    ctx.moveTo(i, y1);
    ctx.lineTo(i, y2);
  }
  ctx.stroke();
  return canvas.toDataURL();
}

// URL로부터 Blob을 받아 waveform 이미지 생성 (비동기)
async function generateWaveformFromUrl(url, width, height) {
  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return generateWaveformImage(audioBuffer, width, height);
}

function generateTrackInfo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const duration = audioBuffer.duration;
        const width = Math.ceil(duration * 50);
        const waveformImage = generateWaveformImage(audioBuffer, width, 40);
        resolve({
          id: String(Date.now() + Math.random()),
          file,
          delayPx: 0,
          duration,
          width,
          waveformImage
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (e) => {
      if (reader.error && reader.error.name === 'AbortError') return;
      reject(reader.error);
    };
    reader.readAsArrayBuffer(file);
  });
}

// combineAudioFilesWithDelays 함수 수정: track.file이 Blob가 아니면 track.url을 사용하여 fetch함
async function combineAudioFilesWithDelays(tracks) {
  if (tracks.length === 0) return null;
  const audioContext = new AudioContext();

  // track의 오디오 데이터를 Blob으로 읽어 ArrayBuffer로 변환하는 헬퍼 함수
  const readTrackAsArrayBuffer = (track) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const delaySec = track.delayPx * 0.02;
          resolve({ buffer: audioBuffer, delaySec });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (e) => {
        if (reader.error && reader.error.name === 'AbortError') return;
        reject(reader.error);
      };

      if (track.file instanceof Blob) {
        reader.readAsArrayBuffer(track.file);
      } else if (track.url) {
        fetch(track.url)
          .then((res) => res.blob())
          .then((blob) => {
            reader.readAsArrayBuffer(blob);
          })
          .catch((err) => reject(err));
      } else {
        reject(new Error("No valid file or url found for track"));
      }
    });
  };

  const promises = tracks.map(track => readTrackAsArrayBuffer(track));
  const decodedTracks = await Promise.all(promises);
  
  // 출력 버퍼의 채널 수는 모든 트랙 중 최대 채널 수로 결정
  const sampleRate = decodedTracks[0].buffer.sampleRate;
  const numChannels = Math.max(...decodedTracks.map(dt => dt.buffer.numberOfChannels));

  const trackInfos = decodedTracks.map(({ buffer, delaySec }) => {
    const delaySamples = Math.floor(delaySec * sampleRate);
    const endSample = delaySamples + buffer.length;
    return { buffer, delaySamples, endSample };
  });
  const totalLength = Math.max(...trackInfos.map(info => info.endSample));
  const outputBuffer = audioContext.createBuffer(numChannels, totalLength, sampleRate);
  
  trackInfos.forEach(({ buffer, delaySamples }) => {
    for (let channel = 0; channel < numChannels; channel++) {
      const outputData = outputBuffer.getChannelData(channel);
      // 해당 트랙에 채널이 없으면 채널 0의 데이터를 사용
      const inputChannel = (channel < buffer.numberOfChannels) ? channel : 0;
      const inputData = buffer.getChannelData(inputChannel);
      for (let i = 0; i < inputData.length; i++) {
        const idx = i + delaySamples;
        if (idx < totalLength) {
          outputData[idx] += inputData[i];
        }
      }
    }
  });
  
  const wavBuffer = audioBufferToWav(outputBuffer);
  const blob = new Blob([new DataView(wavBuffer)], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

// =======================
// 비디오 관련 헬퍼 함수들
// =======================
function generateVideoTrackInfo(file) {
  return new Promise((resolve, reject) => {
    const videoElem = document.createElement('video');
    videoElem.preload = 'metadata';
    videoElem.muted = true;
    videoElem.src = URL.createObjectURL(file);
    videoElem.onloadedmetadata = () => {
      const videoDuration = videoElem.duration;
      const timelineWidth = Math.ceil(videoDuration * 50);
      const videoWidth = videoElem.videoWidth;
      const videoHeight = videoElem.videoHeight;
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      videoElem.currentTime = 0;
      videoElem.onseeked = () => {
        ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL('image/png');
        resolve({
          id: String(Date.now() + Math.random()),
          file,
          delayPx: 0,
          duration: videoDuration,
          width: timelineWidth,
          thumbnail,
          videoWidth,
          videoHeight
        });
      };
    };
    videoElem.onerror = (error) => {
      reject(error);
    };
  });
}

// =======================
// 메인 CombinedTrack 컴포넌트
// =======================
const CombinedTrack = ({ initialJson }) => {
  const [blueTracks, setBlueTracks] = useState([]);
  const [redTracks, setRedTracks] = useState([]);
  const [combinedAudioUrl, setCombinedAudioUrl] = useState(null);
  const [outputUrl, setOutputUrl] = useState(null);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [selectedBlueTrackId, setSelectedBlueTrackId] = useState(null);

  const { videoURL, currentTime, setCurrentTime, duration, videoRef, setVideoURL, uploadedVideos } = useContext(VideoContext);
  const mintContainerRef = useRef(null);
  const waveSurferRef = useRef(null);
  const sliderRef = useRef(null);

  // ▶️ initialJson prop이 전달되면 자동으로 blue track 생성 및 jsonData 설정
  useEffect(() => {
    if (initialJson) {
      const newBlueTrack = {
        id: String(Date.now() + Math.random()),
        tracks: [],
        jsonData: initialJson,
        jsonApplied: false
      };
      setBlueTracks([newBlueTrack]);
    }
  }, [initialJson]);

  // ★ 새로운 버튼 동작: VideoContext의 JSON 파일들을 처리하여
  // 1. 배경음(blue track)  2. 화자별 TTS(blue track)  3. 비디오(red track)를 추가함.
  const handleProcessJsonTracks = async () => {
    if (!uploadedVideos || uploadedVideos.length === 0) {
      alert("처리할 JSON 파일이 없습니다.");
      return;
    }
    // 각 JSON 데이터마다 처리
    for (const json of uploadedVideos) {
      // 1. 배경음 처리 (blue track 추가)
      const bgUrl = `http://localhost:8000/extracted_audio/${json.background_music.file_path
        .replace(/^extracted_audio[\\/]/, '')
        .replace(/\\/g, '/')}`;
      const bgWidth = Math.ceil(json.video.duration * 50);
      const bgWaveformImage = await generateWaveformFromUrl(bgUrl, bgWidth, 40);
      const bgTrack = {
        id: "bg-" + Date.now() + Math.random(),
        delayPx: 0,
        duration: json.video.duration,
        width: bgWidth,
        waveformImage: bgWaveformImage,
        url: bgUrl // URL 추가
      };
      const newBlueTrackForBG = {
        id: "blue-bg-" + Date.now() + Math.random(),
        tracks: [bgTrack],
        jsonData: json,
        jsonApplied: true
      };
      setBlueTracks(prev => [...prev, newBlueTrackForBG]);

      // 2. 화자별 TTS 처리 (blue track 추가)
      const speakers = {};
      for (const tts of json.tts_tracks) {
        const spk = tts.speaker;
        if (!speakers[spk]) speakers[spk] = [];
        speakers[spk].push(tts);
      }
      for (const speaker of Object.keys(speakers)) {
        const ttsTracks = speakers[speaker];
        const ttsTrackObjects = [];
        for (const tts of ttsTracks) {
          const ttsUrl = `http://localhost:8000/extracted_audio/${tts.file_path
            .replace(/^extracted_audio[\\/]/, '')
            .replace(/\\/g, '/')}`;
          const ttsWidth = Math.ceil(tts.duration * 50);
          const waveformImage = await generateWaveformFromUrl(ttsUrl, ttsWidth, 40);
          ttsTrackObjects.push({
            id: "tts-" + tts.tts_id,
            delayPx: Math.round(tts.start_time * 50),
            duration: tts.duration,
            width: ttsWidth,
            waveformImage: waveformImage,
            url: ttsUrl // URL 추가
          });
        }
        const newBlueTrackForSpeaker = {
          id: "blue-tts-" + speaker + "-" + Date.now() + Math.random(),
          tracks: ttsTrackObjects,
          speaker,
          jsonData: json,
          jsonApplied: true
        };
        setBlueTracks(prev => [...prev, newBlueTrackForSpeaker]);
      }

      // 3. 비디오 처리 (red track 추가)
      const videoUrl = `http://localhost:8000/videos/${json.video.file_name}`;
      let videoBlob;
      try {
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
          throw new Error("비디오 파일을 가져오는데 실패했습니다.");
        }
        videoBlob = await videoResponse.blob();
      } catch (error) {
        console.error("비디오 파일 Blob 가져오기 오류:", error);
        videoBlob = null;
      }
      const videoTrack = {
        id: "video-" + json.video.video_id,
        delayPx: 0,
        duration: json.video.duration,
        width: Math.ceil(json.video.duration * 50),
        thumbnail: videoUrl,
        file: videoBlob  // Blob 데이터 추가
      };
      const newRedTrack = {
        id: "red-video-" + Date.now() + Math.random(),
        tracks: [videoTrack],
        jsonData: json,
        jsonApplied: true
      };
      setRedTracks(prev => [...prev, newRedTrack]);
    }
  };

  // blue track 추가 (수동)
  const addBlueTrack = () => {
    setBlueTracks(prev => [...prev, { id: String(Date.now() + Math.random()), tracks: [] }]);
  };

  // red track 추가 (수동)
  const addRedTrack = () => {
    setRedTracks(prev => [...prev, { id: String(Date.now() + Math.random()), tracks: [] }]);
  };

  // 파일 업로드 핸들러 (blueTracks)
  const handleFileUploadForBlueTrack = async (blueTrackId, e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      try {
        const newTrackInfos = await Promise.all(
          files.map(file => generateTrackInfo(file))
        );
        setBlueTracks(prev =>
          prev.map(bt =>
            bt.id === blueTrackId
              ? { ...bt, tracks: [...bt.tracks, ...newTrackInfos] }
              : bt
          )
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  // 파일 업로드 핸들러 (redTracks)
  const handleFileUploadForRedTrack = async (redTrackId, e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      try {
        const newTrackInfos = await Promise.all(
          files.map(file => generateVideoTrackInfo(file))
        );
        setRedTracks(prev =>
          prev.map(rt =>
            rt.id === redTrackId
              ? { ...rt, tracks: [...rt.tracks, ...newTrackInfos] }
              : rt
          )
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  // 드래그 핸들러 (blueTracks)
  const handleBlueTrackMouseDown = (e, blueTrackId, trackId) => {
    e.preventDefault();
    const startX = e.clientX;
    const item = e.currentTarget;
    const initialLeft = parseInt(item.style.left, 10) || 0;
    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      let newLeft = initialLeft + delta;
      const containerRect = item.parentElement.getBoundingClientRect();
      newLeft = Math.max(0, Math.min(newLeft, containerRect.width - item.offsetWidth));
      item.style.left = `${newLeft}px`;
    };
    const onMouseUp = () => {
      const containerRect = item.parentElement.getBoundingClientRect();
      let finalLeft = parseInt(item.style.left, 10) || 0;
      finalLeft = Math.max(0, Math.min(finalLeft, containerRect.width - item.offsetWidth));
      setBlueTracks(prev =>
        prev.map(bt =>
          bt.id === blueTrackId
            ? { ...bt, tracks: bt.tracks.map(t => (t.id === trackId ? { ...t, delayPx: finalLeft } : t)) }
            : bt
        )
      );
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // 드래그 핸들러 (redTracks)
  const handleRedTrackMouseDown = (e, redTrackId, trackId) => {
    e.preventDefault();
    const startX = e.clientX;
    const item = e.currentTarget;
    const initialLeft = parseInt(item.style.left, 10) || 0;
    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      let newLeft = initialLeft + delta;
      const containerRect = item.parentElement.getBoundingClientRect();
      newLeft = Math.max(0, Math.min(newLeft, containerRect.width - item.offsetWidth));
      item.style.left = `${newLeft}px`;
    };
    const onMouseUp = () => {
      const containerRect = item.parentElement.getBoundingClientRect();
      let finalLeft = parseInt(item.style.left, 10) || 0;
      finalLeft = Math.max(0, Math.min(finalLeft, containerRect.width - item.offsetWidth));
      setRedTracks(prev =>
        prev.map(rt =>
          rt.id === redTrackId
            ? { ...rt, tracks: rt.tracks.map(t => (t.id === trackId ? { ...t, delayPx: finalLeft } : t)) }
            : rt
        )
      );
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // blueTracks 변경 시 오디오 병합 (WaveSurfer용)
  useEffect(() => {
    const mergedTracks = [];
    for (const bt of blueTracks) {
      for (const t of bt.tracks) {
        mergedTracks.push(t);
      }
    }
    if (mergedTracks.length > 0) {
      combineAudioFilesWithDelays(mergedTracks)
        .then(url => setCombinedAudioUrl(url))
        .catch(err => console.error(err));
    }
  }, [blueTracks]);

  // WaveSurfer 초기화 (오디오 파형 렌더링)
  useEffect(() => {
    if (combinedAudioUrl && mintContainerRef.current) {
      if (waveSurferRef.current) {
        try {
          waveSurferRef.current.destroy();
        } catch (error) {
          console.error(error);
        }
      }
      waveSurferRef.current = WaveSurfer.create({
        container: mintContainerRef.current,
        waveColor: '#555',
        progressColor: '#ff5500',
        cursorColor: '#333',
        barWidth: 2,
        height: 60,
        minPxPerSec: 50,
        scrollParent: true,
        fillParent: false
      });
      waveSurferRef.current.load(combinedAudioUrl);
      waveSurferRef.current.on('ready', () => {
        waveSurferRef.current.zoom(50);
      });
    }
    return () => {
      if (waveSurferRef.current) {
        try {
          waveSurferRef.current.destroy();
        } catch (error) {
          console.error(error);
        }
      }
    };
  }, [combinedAudioUrl]);

  const handlePlayPause = () => {
    if (waveSurferRef.current) {
      waveSurferRef.current.playPause();
    }
  };

  useEffect(() => {
    if (sliderRef.current) {
      // 필요에 따라 슬라이더 길이 업데이트
    }
  }, [sliderRef, videoURL, duration]);

  const handleSliderChange = (e) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // JSON 입력 모달 (blueTracks용)
  const openJsonModal = (blueTrackId) => {
    setSelectedBlueTrackId(blueTrackId);
    setShowJsonModal(true);
  };

  const handleJsonCancel = () => {
    setShowJsonModal(false);
    setJsonText('');
    setSelectedBlueTrackId(null);
  };

  const handleJsonSubmit = () => {
    try {
      const parsed = JSON.parse(jsonText);
      console.log("Parsed JSON:", parsed);
      setBlueTracks(prev =>
        prev.map(bt =>
          bt.id === selectedBlueTrackId ? { ...bt, jsonData: parsed, jsonApplied: false } : bt
        )
      );
    } catch (error) {
      console.error("Invalid JSON:", error);
      alert("입력한 텍스트가 유효한 JSON 형식이 아닙니다.");
      return;
    }
    setShowJsonModal(false);
    setJsonText('');
    setSelectedBlueTrackId(null);
  };

  // ★★★★★★ 최종 영상 병합 함수 (서버 /merge-media 엔드포인트 사용) ★★★★★★
  const handleMergeMedia = async () => {
    if (!combinedAudioUrl) {
      alert("병합된 오디오가 없습니다.");
      return;
    }
    // redTracks의 각 그룹에서 파일을 가져오고, 그룹 인덱스를 함께 포함하여 flat한 배열 생성
    const allRedTracks = redTracks.flatMap((group, groupIndex) =>
      group.tracks.map(track => ({ ...track, groupIndex }))
    );
    if (allRedTracks.length === 0) {
      alert("비디오 트랙이 없습니다.");
      return;
    }
    // 각 비디오의 시작 시간 계산 (초)
    const startTimes = allRedTracks.map(track => track.delayPx / 50);
    // 각 비디오의 red track 그룹 인덱스 배열
    const redTrackIndices = allRedTracks.map(track => track.groupIndex);
    
    // 정렬: 낮은 그룹 인덱스가 최종 합성 시 더 높은 우선순위가 되도록 내림차순 정렬
    const sortedArray = allRedTracks
      .map((track, index) => ({ ...track, startTime: startTimes[index], redIndex: redTrackIndices[index] }))
      .sort((a, b) => a.redIndex - b.redIndex)
      .reverse();
    const sortedStartTimes = sortedArray.map(item => item.startTime);
    
    // 외부 오디오(WAV) 처리: combinedAudioUrl에서 Blob 가져오기
    const audioResponse = await fetch(combinedAudioUrl);
    const audioBlob = await audioResponse.blob();
    const audioFile = new File([audioBlob], "merged_audio.wav", { type: "audio/wav" });
    
    // FormData 구성: 각 비디오 파일은 sortedArray 순서대로 전송
    const formData = new FormData();
    formData.append("audio", audioFile);
    sortedArray.forEach(track => {
      formData.append("video", track.file);
    });
    formData.append("start_times", JSON.stringify(sortedStartTimes));
    formData.append("red_track_indices", JSON.stringify(sortedArray.map(item => item.redIndex)));
    
    try {
      const response = await fetch("http://localhost:8000/merge-media", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("서버 병합 오류");
      }
      const mergedBlob = await response.blob();
      const mergedUrl = URL.createObjectURL(mergedBlob);
      setOutputUrl(mergedUrl);
      alert("병합 완료!");
    } catch (error) {
      console.error(error);
      alert("병합 중 오류 발생: " + error.message);
    }
  };
  // ★★★★★★ 끝 ★★★★★★

  // 최종 영상 전송 함수
  const handleSendFinalVideo = () => {
    if (outputUrl) {
      setVideoURL('');
      setTimeout(() => {
        setVideoURL(outputUrl);
        alert("최종 영상이 전송되었습니다.");
      }, 0);
    } else {
      alert("먼저 최종 영상을 병합해주세요.");
    }
  };

  return (
    <div>
      <div style={{ display: 'flex' }}>
        {/* 왼쪽 컨테이너 */}
        <div style={{ width: '300px', flexShrink: 0, border: '1px solid #ccc', padding: '10px', boxSizing: 'border-box' }}>
          <h3>Additional Container</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={handlePlayPause}>Play/Pause (WS)</button>
          </div>
          <div style={{ marginTop: '10px' }}>
            <button onClick={addBlueTrack}>Add Blue Track</button>
          </div>
          <div style={{ marginTop: '10px' }}>
            <button onClick={addRedTrack}>Add Red Track</button>
          </div>
          {/* 새로 추가한 버튼: VideoContext의 JSON 파일들을 처리 */}
          <div style={{ marginTop: '10px' }}>
            <button onClick={handleProcessJsonTracks}>Process JSON Tracks</button>
          </div>
          {/* 서버 병합 버튼 */}
          <div style={{ marginTop: '10px' }}>
            <button onClick={handleMergeMedia}>Merge &amp; Download Video</button>
          </div>
          {outputUrl && (
            <>
              <div style={{ marginTop: '10px' }}>
                <a href={outputUrl} download="merged_output.mp4">최종 영상 다운로드</a>
              </div>
              <div style={{ marginTop: '10px' }}>
                <button onClick={handleSendFinalVideo}>최종 영상 보내기</button>
              </div>
            </>
          )}
          <VideoPlaybackControl />
        </div>
        {/* 오른쪽 공통 컨테이너 */}
        <div style={commonContainerStyle}>
          {/* 타임라인 및 슬라이더 */}
          <div style={{ ...timelineContainerStyle, position: 'sticky', top: 0 }}>
            <div style={{ width: `${duration * 50}px`, position: 'relative' }}>
              {duration > 0 && renderTimelineComponent(duration)}
              <div ref={sliderRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1000 }}>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={currentTime}
                  onInput={(e) => {
                    const newTime = parseFloat(e.target.value);
                    if (videoRef.current) {
                      videoRef.current.currentTime = newTime;
                      setCurrentTime(newTime);
                    }
                  }}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
          {/* 민트색 상자 (오디오 파형) */}
          <div style={mintBoxStyle} ref={mintContainerRef} />
          {/* blueTracks 렌더링 (오디오 트랙) */}
          {blueTracks.map(bt => (
            <div key={bt.id} style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                <button onClick={() => document.getElementById(`file-input-blue-${bt.id}`).click()}>
                  Upload Audio File
                </button>
                <button onClick={() => openJsonModal(bt.id)}>입력 JSON</button>
              </div>
              <input
                id={`file-input-blue-${bt.id}`}
                type="file"
                accept="audio/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFileUploadForBlueTrack(bt.id, e)}
              />
              <div style={blueBoxStyle}>
                {bt.tracks.map(track => (
                  <div
                    key={track.id}
                    style={{
                      ...draggableItemStyle,
                      left: `${track.delayPx}px`,
                      width: `${track.width}px`
                    }}
                    onMouseDown={(e) => handleBlueTrackMouseDown(e, bt.id, track.id)}
                  >
                    <img src={track.waveformImage} alt="waveform" style={{ width: '100%', height: '100%' }} />
                  </div>
                ))}
              </div>
              {bt.jsonData && (
                <div style={{ marginTop: '5px', fontSize: '12px', color: '#333' }}>
                  <pre>{JSON.stringify(bt.jsonData, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
          {/* redTracks 렌더링 (비디오 트랙) */}
          {redTracks.map(rt => (
            <div key={rt.id} style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                <button onClick={() => document.getElementById(`file-input-red-${rt.id}`).click()}>
                  Upload Video File
                </button>
              </div>
              <input
                id={`file-input-red-${rt.id}`}
                type="file"
                accept="video/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFileUploadForRedTrack(rt.id, e)}
              />
              <div style={redBoxStyle}>
                {rt.tracks.map(track => (
                  <div
                    key={track.id}
                    style={{
                      ...draggableItemStyle,
                      left: `${track.delayPx}px`,
                      width: `${track.width}px`
                    }}
                    onMouseDown={(e) => handleRedTrackMouseDown(e, rt.id, track.id)}
                  >
                    <img src={track.thumbnail} alt="video thumbnail" style={{ width: '100%', height: '100%' }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* JSON 입력 모달 */}
      {showJsonModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '5px',
              width: '80%',
              maxWidth: '500px'
            }}
          >
            <h3>JSON 텍스트 입력</h3>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              style={{ width: '100%', height: '200px' }}
            />
            <div style={{ marginTop: '10px', textAlign: 'right' }}>
              <button onClick={handleJsonCancel} style={{ marginRight: '10px' }}>
                취소
              </button>
              <button onClick={handleJsonSubmit}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CombinedTrack;
