import { useState } from "react";
import { Settings, DEFAULT_SETTINGS } from "../types";
import { ArrowLeft, Cpu, FileText, Volume2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface SettingsPanelProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const [formData, setFormData] = useState<Settings>(settings);

  const handleChange = (field: keyof Settings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const handleReset = () => {
    setFormData(DEFAULT_SETTINGS);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Top nav */}
      <div className="flex items-center gap-2 py-2">
        <button
          onClick={onClose}
          className="cursor-pointer text-muted-foreground hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      {/* Form */}
      <div className="pb-4 space-y-4">
          {/* LLM Section */}
          <section className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                LLM Configuration
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Endpoint URL</label>
                <Input
                  value={formData.llmEndpoint}
                  onChange={(e) => handleChange("llmEndpoint", e.target.value)}
                  placeholder={DEFAULT_SETTINGS.llmEndpoint}
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">API Key</label>
                <Input
                  type="password"
                  value={formData.llmApiKey}
                  onChange={(e) => handleChange("llmApiKey", e.target.value)}
                  placeholder="Optional for local LLMs"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Model</label>
                <Input
                  value={formData.llmModel}
                  onChange={(e) => handleChange("llmModel", e.target.value)}
                  placeholder={DEFAULT_SETTINGS.llmModel}
                />
              </div>
            </div>
          </section>

          {/* TTS Section */}
          <section className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Volume2 className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                TTS Configuration
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Endpoint URL</label>
                <Input
                  value={formData.ttsEndpoint}
                  onChange={(e) => handleChange("ttsEndpoint", e.target.value)}
                  placeholder={DEFAULT_SETTINGS.ttsEndpoint}
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Voice ID</label>
                <Input
                  value={formData.ttsVoice}
                  onChange={(e) => handleChange("ttsVoice", e.target.value)}
                  placeholder={DEFAULT_SETTINGS.ttsVoice}
                />
              </div>
            </div>
          </section>

          {/* Prompts Section */}
          <section className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Prompts
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">
                  Executive Summary Prompt
                </label>
                <Textarea
                  value={formData.promptExecutiveSummary}
                  onChange={(e) => handleChange("promptExecutiveSummary", e.target.value)}
                  rows={4}
                  placeholder="Enter prompt template..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {"{{content}}"} as placeholder
                </p>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">
                  Distilled Summary Prompt
                </label>
                <Textarea
                  value={formData.promptDistilledSummary}
                  onChange={(e) => handleChange("promptDistilledSummary", e.target.value)}
                  rows={4}
                  placeholder="Enter prompt template..."
                />
              </div>
            </div>
          </section>
        </div>

        {/* Action buttons (floating) */}
        <div className="flex items-center justify-between p-4">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Settings
            </Button>
          </div>
        </div>
    </div>
  );
}