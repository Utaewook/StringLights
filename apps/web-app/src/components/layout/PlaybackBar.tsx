import { useEffect, useRef, useState } from 'react';
import { usePlaybackStore } from '../../store/playbackStore';

const SPEEDS = [0.5, 1, 2, 5];

export default function PlaybackBar() {
  const {
    isActive, isPlaying, currentStep, totalSteps, playbackSpeed,
    startPlayback, pausePlayback, stopPlayback, seekStep,
    setCurrentStep, setPlaybackSpeed, closePlayback,
  } = usePlaybackStore();

  const [visible, setVisible] = useState(true);
  const [mouseOver, setMouseOver] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide after 5s idle when not playing
  useEffect(() => {
    if (!isActive) return;

    const resetTimer = () => {
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (!isPlaying && !mouseOver) {
        hideTimer.current = setTimeout(() => setVisible(false), 5000);
      }
    };

    window.addEventListener('mousemove', resetTimer);
    resetTimer();

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isActive, isPlaying, mouseOver]);

  if (!isActive) return null;

  const barVisible = visible || mouseOver || isPlaying;

  return (
    <div
      className={`playback-bar-container ${barVisible ? '' : 'hidden'}`}
      onMouseEnter={() => setMouseOver(true)}
      onMouseLeave={() => setMouseOver(false)}
    >
      {/* Controls */}
      <div className="playback-controls">
        <button
          className="playback-btn"
          onClick={() => seekStep(-1)}
          title="이전 스텝"
          disabled={currentStep === 0}
        >
          ⏮
        </button>

        <button
          className="playback-btn primary"
          onClick={isPlaying ? pausePlayback : startPlayback}
          title={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          className="playback-btn"
          onClick={() => seekStep(1)}
          title="다음 스텝"
          disabled={currentStep >= totalSteps - 1}
        >
          ⏭
        </button>

        <button className="playback-btn" onClick={stopPlayback} title="정지">
          ⏹
        </button>

        {/* Speed selector */}
        <div className="speed-selector">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`speed-btn ${playbackSpeed === s ? 'active' : ''}`}
              onClick={() => setPlaybackSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div className="playback-progress-container">
        <span className="step-display">Step {currentStep + 1}</span>
        <input
          type="range"
          className="progress-slider"
          min={0}
          max={Math.max(0, totalSteps - 1)}
          step={1}
          value={currentStep}
          onChange={(e) => setCurrentStep(Number(e.target.value))}
        />
        <span className="step-display">{totalSteps} Steps</span>
      </div>

      {/* Close button */}
      <button className="playback-btn close-btn" onClick={closePlayback} title="닫기">
        ✕
      </button>
    </div>
  );
}
