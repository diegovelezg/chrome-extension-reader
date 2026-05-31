import { BarChart3, PencilLine, FileText } from "lucide-react";
import { Mode } from "../types";

interface ModeSelectorProps {
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
}

const modeIcons: Record<Mode, typeof BarChart3> = {
  executive: BarChart3,
  distilled: PencilLine,
  original: FileText,
};

const modeLabels: Record<Mode, string> = {
  executive: "Executive",
  distilled: "Distilled",
  original: "Original",
};

export function ModeSelector({ activeMode, onModeChange }: ModeSelectorProps) {
  const modes: Mode[] = ["executive", "distilled", "original"];

  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {modes.map((mode) => {
        const Icon = modeIcons[mode];
        return (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={`
            flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md
            text-sm font-medium transition-all cursor-pointer
            ${
              activeMode === mode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }
          `}
          >
            <Icon className="size-4" />
            <span>{modeLabels[mode]}</span>
          </button>
        );
      })}
    </div>
  );
}