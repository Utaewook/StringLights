import React, { useState, useEffect, useRef } from 'react';
import usePlaybackStore from '../../store/playbackStore';

const PlaybackBar = () => {
    const {
        isActive,
        isPlaying,
        currentTime,
        totalDuration,
        playbackSpeed,
        startPlayback,
        pausePlayback,
        stopPlayback,
        seek,
        seekStep,
        setPlaybackSpeed,
        playbackMode,
        setPlaybackMode,
        traceData
    } = usePlaybackStore();

    const [isMouseOver, setIsMouseOver] = useState(false);
    const [isBarVisible, setIsBarVisible] = useState(true);
    const hideTimeoutRef = useRef(null);

    // Auto-hide logic
    useEffect(() => {
        const handleMouseMove = () => {
            setIsBarVisible(true);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

            if (!isMouseOver) {
                hideTimeoutRef.current = setTimeout(() => {
                    if (isPlaying) return; // Don't hide while playing
                    setIsBarVisible(false);
                }, 5000); // 5s idle to hide
            }
        };

        if (isActive) {
            window.addEventListener('mousemove', handleMouseMove);
            handleMouseMove();
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [isActive, isMouseOver, isPlaying]);

    if (!isActive) return null;

    const formatTime = (ms) => {
        if (playbackMode === 'step') {
            const stepIndex = Math.min(Math.floor(ms / 500), traceData.length - 1);
            return `Step ${stepIndex + 1}`;
        }

        if (totalDuration < 1000) {
            return `${ms.toFixed(1)}ms`;
        }
        const seconds = (ms / 1000).toFixed(2);
        return `${seconds}s`;
    };

    const handleProgressChange = (e) => {
        seek(parseFloat(e.target.value));
    };

    const speeds = [0.1, 0.5, 1, 2, 5];
    const maxVal = playbackMode === 'step' ? (traceData.length > 0 ? (traceData.length - 1) * 500 : 0) : totalDuration;

    return (
        <div
            className={`playback-bar-container ${(isBarVisible || isMouseOver || isPlaying) ? '' : 'hidden'}`}
            onMouseEnter={() => setIsMouseOver(true)}
            onMouseLeave={() => setIsMouseOver(false)}
        >
            <div className="playback-controls">
                <div className="mode-toggle">
                    <button
                        className={`mode-btn-small ${playbackMode === 'time' ? 'active' : ''}`}
                        onClick={() => setPlaybackMode('time')}
                        title="Real-time mode"
                    >
                        T
                    </button>
                    <button
                        className={`mode-btn-small ${playbackMode === 'step' ? 'active' : ''}`}
                        onClick={() => setPlaybackMode('step')}
                        title="Step-by-Step mode"
                    >
                        S
                    </button>
                </div>

                <div className="playback-btn-group" style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                    <button
                        className="playback-btn"
                        onClick={() => seekStep(-1)}
                        title="Step Backward"
                    >
                        ⏮
                    </button>
                    <button
                        className="playback-btn primary"
                        onClick={isPlaying ? pausePlayback : startPlayback}
                        title={isPlaying ? "Pause" : "Play"}
                    >
                        {isPlaying ? '⏸' : '▶'}
                    </button>
                    <button
                        className="playback-btn"
                        onClick={() => seekStep(1)}
                        title="Step Forward"
                    >
                        ⏭
                    </button>
                    <button className="playback-btn" onClick={stopPlayback} title="Stop">
                        ⏹
                    </button>
                </div>

                {playbackMode === 'time' && (
                    <div className="speed-selector">
                        {speeds.map(s => (
                            <button
                                key={s}
                                className={`speed-btn ${playbackSpeed === s ? 'active' : ''}`}
                                onClick={() => setPlaybackSpeed(s)}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="playback-progress-container">
                <span className="time-display">{formatTime(currentTime)}</span>
                <input
                    type="range"
                    className="progress-slider"
                    min="0"
                    max={maxVal}
                    step={playbackMode === 'step' ? 500 : 1}
                    value={currentTime}
                    onChange={handleProgressChange}
                />
                <span className="time-display">
                    {playbackMode === 'step' ? `${traceData.length} Steps` : formatTime(totalDuration)}
                </span>
            </div>
        </div>
    );
};

export default PlaybackBar;
