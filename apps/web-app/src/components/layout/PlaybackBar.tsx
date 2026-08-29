import { useEffect, useRef, useState } from 'react';
import { SkipBack, SkipForward, Play, Pause, Square, X } from 'lucide-react';
import { usePlaybackStore } from '../../store/playbackStore';
import { Button } from '../ui/Button';
import { ToggleGroup } from '../ui/ToggleGroup';
import './PlaybackBar.css';

const SPEEDS = [0.5, 1, 2, 5] as const;

const SPEED_ITEMS = SPEEDS.map((s) => ({
  value: s,
  label: `${s}x`,
  title: `Play at ${s}x speed`,
}));

/** How long the bar stays up after the pointer stops moving, when not playing. */
const IDLE_HIDE_MS = 5000;

export default function PlaybackBar() {
  const {
    isActive, isPlaying, currentStep, totalSteps, playbackSpeed,
    startPlayback, pausePlayback, stopPlayback, seekStep,
    setCurrentStep, setPlaybackSpeed, closePlayback,
  } = usePlaybackStore();

  const [visible, setVisible] = useState(true);
  const [mouseOver, setMouseOver] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide after an idle spell when not playing
  useEffect(() => {
    if (!isActive) return;

    const resetTimer = () => {
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (!isPlaying && !mouseOver) {
        hideTimer.current = setTimeout(() => setVisible(false), IDLE_HIDE_MS);
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
      {/* ── Transport ─────────────────────────────────────────────────────── */}
      <div className="playback-controls">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => seekStep(-1)}
          title="Previous step"
          aria-label="Previous step"
          disabled={currentStep === 0}
        >
          <SkipBack />
        </Button>

        <Button
          size="icon"
          onClick={isPlaying ? pausePlayback : startPlayback}
          title={isPlaying ? 'Pause' : 'Play'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause /> : <Play />}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => seekStep(1)}
          title="Next step"
          aria-label="Next step"
          disabled={currentStep >= totalSteps - 1}
        >
          <SkipForward />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={stopPlayback}
          title="Stop"
          aria-label="Stop"
        >
          <Square />
        </Button>

        <ToggleGroup
          className="playback-speed"
          items={SPEED_ITEMS}
          value={playbackSpeed}
          onValueChange={setPlaybackSpeed}
          size="sm"
          aria-label="Playback speed"
        />
      </div>

      {/* ── Progress ──────────────────────────────────────────────────────── */}
      <div className="playback-progress-container">
        {/* -1 is the store's "not started" sentinel; rendering it as "Step 0"
            reads as a real step that does not exist. */}
        <span className="step-display">
          {currentStep < 0 ? 'Ready' : `Step ${currentStep + 1}`}
        </span>
        <input
          type="range"
          className="progress-slider"
          min={0}
          max={Math.max(0, totalSteps - 1)}
          step={1}
          value={currentStep}
          aria-label="Playback position"
          onChange={(e) => setCurrentStep(Number(e.target.value))}
        />
        <span className="step-display">{totalSteps} steps</span>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={closePlayback}
        title="Close playback"
        aria-label="Close playback"
      >
        <X />
      </Button>
    </div>
  );
}
