import { useState } from "react";
import { Settings, DEFAULT_SETTINGS } from "../types";
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
    <div className="bg-background border rounded-lg shadow-sm w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Settings</h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-6">
          {/* LLM Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              LLM Configuration
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Endpoint URL</label>
                <Input
                  value={formData.llmEndpoint}
                  onChange={(e) => handleChange("llmEndpoint", e.target.value)}
                  placeholder="http://localhost:11434"
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
                  placeholder="llama3"
                />
              </div>
            </div>
          </div>

          {/* TTS Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              TTS Configuration
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Endpoint URL</label>
                <Input
                  value={formData.ttsEndpoint}
                  onChange={(e) => handleChange("ttsEndpoint", e.target.value)}
                  placeholder="http://localhost:8020"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Voice ID</label>
                <Input
                  value={formData.ttsVoice}
                  onChange={(e) => handleChange("ttsVoice", e.target.value)}
                  placeholder="default"
                />
              </div>
            </div>
          </div>

          {/* Prompts Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Prompts
            </h3>
            
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
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/50">
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