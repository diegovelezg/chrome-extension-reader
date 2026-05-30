import { Mode } from "../types";

interface ModeSelectorProps {
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
}

const modes: { id: Mode; label: string; icon: string }[] = [
  { id: "executive", label: "Executive", icon: "📊" },
  { id: "distilled", label: "Distilled", icon: "📝" },
  { id: "original", label: "Original", icon: "📄" },
];

export function ModeSelector({ activeMode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id)}
          className={`
            flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md
            text-sm font-medium transition-all
            ${
              activeMode === mode.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }
          `}
        >
          <span>{mode.icon}</span>
          <span>{mode.label}</span>
        </button>
      ))}
    </div>
  );
}