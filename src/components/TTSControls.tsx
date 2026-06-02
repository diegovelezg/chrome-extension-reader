import { Loader2, Pause, Play, Square } from "lucide-react";

const SPEED_VALUES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

interface TTSControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  isPaused: boolean;
  speed: number;
  error: string | null;
  disabled?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
}

export function TTSControls({
  isPlaying,
  isLoading,
  isPaused,
  speed,
  error,
  disabled,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSpeedChange,
}: TTSControlsProps) {
  const btnBase = "flex items-center justify-center p-1.5 rounded-md hover:bg-accent text-foreground hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none";

  const cycleSpeed = () => {
    const idx = SPEED_VALUES.findIndex((v) => Math.abs(v - speed) < 0.01);
    onSpeedChange(SPEED_VALUES[(idx + 1) % SPEED_VALUES.length]);
  };

  return (
    <div className="flex items-center gap-0.5">
      {isLoading ? (
        <button disabled className={btnBase}>
          <Loader2 className="size-3.5 animate-spin" />
        </button>
      ) : !isPlaying && !isPaused ? (
        <button onClick={onPlay} disabled={disabled} title={error || "Play"} className={btnBase}>
          <Play className="size-3.5 fill-current" />
        </button>
      ) : isPlaying ? (
        <button onClick={onPause} disabled={disabled} title="Pause" className={btnBase}>
          <Pause className="size-3.5 fill-current" />
        </button>
      ) : (
        <button onClick={onResume} disabled={disabled} title="Resume" className={btnBase}>
          <Play className="size-3.5 fill-current" />
        </button>
      )}

      {(isPlaying || isPaused) && (
        <button onClick={onStop} disabled={disabled} title="Stop" className={btnBase}>
          <Square className="size-3 fill-current" />
        </button>
      )}

      <button
        onClick={cycleSpeed}
        disabled={disabled}
        title={`Speed: ${speed}x`}
        className="px-1.5 py-0.5 rounded-md hover:bg-accent text-[10px] font-medium tabular-nums text-muted-foreground hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
      >
        {speed}x
      </button>
    </div>
  );
}
