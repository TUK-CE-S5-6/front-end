import React, { useState, useRef, useEffect } from 'react';

const VideoTimeline = () => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [selectedClip, setSelectedClip] = useState(null);

  const timelineRef = useRef(null);

  const [clips, setClips] = useState([
    { id: 1, name: 'Video Clip 1', start: 0, duration: 25, color: 'bg-blue-500', type: 'video' },
    { id: 2, name: 'Video Clip 2', start: 25, duration: 30, color: 'bg-green-500', type: 'video' },
    { id: 3, name: 'Audio Track', start: 10, duration: 40, color: 'bg-purple-500', type: 'audio' },
  ]);

  const [tracks] = useState([
    { id: 1, name: 'Video Track 1', type: 'video', height: 60 },
    { id: 2, name: 'Video Track 2', type: 'video', height: 60 },
    { id: 3, name: 'Audio Track', type: 'audio', height: 40 },
  ]);

  const handleTimelineClick = (e) => {
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newTime = (x / rect.width) * duration;
    setCurrentTime(Math.max(0, Math.min(newTime, duration)));
  };

  return (
  <div style={{ backgroundColor: '#15151e', color: '#f2f3f5' }}>
    <input
      type="file"
      accept="video/*"
      ref={videoFileInputRef}
      style={{ display: 'none' }}
      onChange={handleVideoFileChange}
    />

    {videoTracks.map(group => (
      <div key={group.id} style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', border: '1px solid #2b2b36' }}>
          {/* 좌측 메뉴 영역 */}
          <div style={{ width: 210, backgroundColor: '#1e1e25', padding: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {editingVideoGroupId === group.id ? (
                <input
                  type="text"
                  value={editingVideoName}
                  onChange={e => setEditingVideoName(e.target.value)}
                  onBlur={() => finishEditingVideoName(group.id)}
                  onKeyDown={e => e.key === 'Enter' && finishEditingVideoName(group.id)}
                  autoFocus
                  style={{
                    fontSize: 12,
                    color: '#f2f3f5',
                    background: '#2b2b36',
                    border: '1px solid #2b2b36',
                    padding: '2px 4px',
                    borderRadius: 4,
                  }}
                />
              ) : (
                <span
                  style={{ fontSize: 12, color: '#f2f3f5', cursor: 'pointer' }}
                  onClick={() => startEditingVideoName(group)}
                >
                  {group.name || 'Video Group'}
                </span>
              )}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() =>
                    setActiveVideoMenuGroup(activeVideoMenuGroup === group.id ? null : group.id)
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f2f3f5',
                    cursor: 'pointer',
                    fontSize: '18px',
                  }}
                >
                  :
                </button>
                {activeVideoMenuGroup === group.id && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '100%',
                      marginLeft: 10,
                      backgroundColor: '#2b2b36',
                      border: '1px solid #2b2b36',
                      zIndex: 1,
                      padding: '4px',
                      borderRadius: '4px',
                    }}
                  >
                    <button
                      onClick={() => handleUploadVideo(group.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f2f3f5',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'block',
                        width: '100%',
                      }}
                    >
                      Upload Video
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f2f3f5',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'block',
                        width: '100%',
                      }}
                    >
                      Delete Group
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 볼륨 컨트롤 */}
            <div style={{ display: 'flex', alignItems: 'center', height: 40, width: 200 }}>
              <button
                onClick={() => handleVolumeToggleVideo(group)}
                style={{
                  width: 40,
                  height: 40,
                  background: '#2b2b36',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 16,
                  marginRight: 5,
                  borderRadius: 4,
                  color: '#f2f3f5',
                }}
              >
                {group.volume === 0 ? '🔇' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={localVolume[group.id] != null ? localVolume[group.id] : group.volume}
                onChange={e => handleVolumeSliderChange(group.id, parseInt(e.target.value, 10))}
                onMouseUp={() => handleVolumeSliderMouseUp(group.id)}
                onTouchEnd={() => handleVolumeSliderMouseUp(group.id)}
                style={{
                  width: 'calc(100% - 45px)',
                  backgroundColor: '#5865f2',
                }}
              />
            </div>
          </div>

          {/* 우측 드롭 영역 */}
          <div
            ref={el => {
              containerRefs.current[group.id] = el;
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, group.id)}
            style={{
              flexGrow: 1,
              backgroundColor: '#1e1e25',
              position: 'relative',
              height: '100px',
              width: `${timelineDuration * 100}px`,
              minWidth: `${timelineDuration * 100}px`,
              overflow: 'hidden',
            }}
          >
            {group.tracks.map(item => {
              const left = draggingItem?.trackId === item.id
                ? draggingItem.newDelayPx
                : (item.delayPx || 0);

              return (
                <div
                  key={item.id}
                  onContextMenu={e => {
                    e.preventDefault();
                    handleContextMenu(e, group.id, item.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${left}px`,
                    top: 0,
                    width: `${item.width || 150}px`,
                    height: '100px',
                    cursor: 'grab',
                    userSelect: 'none',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                  onMouseDown={e =>
                    handleItemMouseDown(e, group.id, item.id, item.delayPx, item.width || 150)
                  }
                >
                  <img
                    src={item.thumbnail}
                    alt="thumb"
                    draggable={false}
                    onDragStart={e => e.preventDefault()}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    ))}

    {/* 우클릭 컨텍스트 메뉴 */}
    {ctxMenu.visible && (
      <div
        style={{
          position: 'fixed',
          top: ctxMenu.y,
          left: ctxMenu.x,
          background: '#2b2b36',
          border: '1px solid #2b2b36',
          padding: 4,
          zIndex: 1000,
          borderRadius: '4px',
        }}
      >
        <button
          onClick={handleDeleteItem}
          style={{
            cursor: 'pointer',
            color: '#f2f3f5',
            background: 'none',
            border: 'none',
            padding: '4px',
          }}
        >
          Delete Video Item
        </button>
      </div>
    )}
  </div>
);
}

export default VideoTimeline;
