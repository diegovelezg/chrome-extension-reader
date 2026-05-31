import { Loader2, Pause, Play, Square, Volume2 } from "lucide-react";
import { Slider } from "../components/ui/slider";

interface TTSControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  speed: number;
  error: string | null;
  isFallback: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
}

export function TTSControls({
  isPlaying,
  isLoading,
  progress,
  speed,
  error,
  isFallback,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSpeedChange,
}: TTSControlsProps) {
  return (
    <div className="flex flex-col gap-3 p-3 bg-muted/50 rounded-lg">
      {isFallback && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded">
          <Volume2 className="size-3" />
          <span>Using browser TTS (no TTS endpoint configured)</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {!isPlaying ? (
          <button
            onClick={onPlay}
            disabled={isLoading}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Play className="size-5 fill-current" />
          </button>
        ) : (
          <button
            onClick={isPlaying ? onPause : onResume}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Pause className="size-5 fill-current" />
          </button>
        )}

        <button
          onClick={onStop}
          disabled={!isPlaying}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 disabled:opacity-50"
        >
          <Square className="size-4 fill-current" />
        </button>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Generating audio...</span>
          </div>
        )}

        {error && (
          <span className="text-sm text-destructive">{error}</span>
        )}
      </div>

      {isPlaying && (
        <div className="space-y-1">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {Math.round(progress)}%
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-12">Speed</span>
        <Slider
          value={[speed]}
          min={0.5}
          max={2}
          step={0.1}
          onValueChange={(value) => {
            const v = Array.isArray(value) ? value[0] : value;
            onSpeedChange(v);
          }}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8">{speed}x</span>
      </div>
    </div>
  );
}