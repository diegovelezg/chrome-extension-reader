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

type FieldErrors = Partial<Record<keyof Settings, string>>;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateField(field: keyof Settings, value: string): string | undefined {
  switch (field) {
    case "llmEndpoint":
      if (!value.trim()) return "Endpoint URL is required";
      if (!isValidUrl(value.trim())) return "Must be a valid URL (http:// or https://)";
      return undefined;
    case "llmModel":
      if (!value.trim()) return "Model is required";
      return undefined;
    case "ttsEndpoint":
      if (!value.trim()) return "Endpoint URL is required";
      if (!isValidUrl(value.trim())) return "Must be a valid URL (http:// or https://)";
      return undefined;
    case "ttsVoice":
      if (!value.trim()) return "Voice ID is required";
      return undefined;
    case "promptExecutiveSummary":
      if (!value.trim()) return "Executive summary prompt is required";
      if (!value.includes("{{content}}")) return "Must include {{content}} placeholder";
      return undefined;
    case "promptDistilledSummary":
      if (!value.trim()) return "Distilled summary prompt is required";
      if (!value.includes("{{content}}")) return "Must include {{content}} placeholder";
      return undefined;
    case "llmApiKey":
    case "ttsApiKey":
      return undefined;
    default:
      return undefined;
  }
}

function validateAll(data: Settings): FieldErrors {
  const errors: FieldErrors = {};
  const fields: (keyof Settings)[] = [
    "llmEndpoint",
    "llmApiKey",
    "llmModel",
    "ttsEndpoint",
    "ttsApiKey",
    "ttsVoice",
    "promptExecutiveSummary",
    "promptDistilledSummary",
  ];
  for (const field of fields) {
    const error = validateField(field, data[field] as string);
    if (error) errors[field] = error;
  }
  return errors;
}

export function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const [formData, setFormData] = useState<Settings>(settings);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof Settings, boolean>>>({});

  const handleChange = (field: keyof Settings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors((prev) => {
        const next = { ...prev };
        if (error) next[field] = error;
        else delete next[field];
        return next;
      });
    }
  };

  const handleBlur = (field: keyof Settings) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field] as string);
    setErrors((prev) => {
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  const handleSave = () => {
    const allErrors = validateAll(formData);
    const allTouched: Partial<Record<keyof Settings, boolean>> = {};
    for (const key of Object.keys(formData) as (keyof Settings)[]) {
      allTouched[key] = true;
    }
    setTouched(allTouched);
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) return;
    onSave(formData);
    onClose();
  };

  const handleReset = () => {
    setFormData(DEFAULT_SETTINGS);
    setErrors({});
    setTouched({});
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
                  onBlur={() => handleBlur("llmEndpoint")}
                  placeholder={DEFAULT_SETTINGS.llmEndpoint}
                />
                {touched.llmEndpoint && errors.llmEndpoint && (
                  <p className="text-xs text-destructive mt-1">{errors.llmEndpoint}</p>
                )}
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
                  onBlur={() => handleBlur("llmModel")}
                  placeholder={DEFAULT_SETTINGS.llmModel}
                />
                {touched.llmModel && errors.llmModel && (
                  <p className="text-xs text-destructive mt-1">{errors.llmModel}</p>
                )}
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
                  onBlur={() => handleBlur("ttsEndpoint")}
                  placeholder={DEFAULT_SETTINGS.ttsEndpoint}
                />
                {touched.ttsEndpoint && errors.ttsEndpoint && (
                  <p className="text-xs text-destructive mt-1">{errors.ttsEndpoint}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">API Key</label>
                <Input
                  type="password"
                  value={formData.ttsApiKey}
                  onChange={(e) => handleChange("ttsApiKey", e.target.value)}
                  placeholder="Optional for local TTS"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Voice ID</label>
                <Input
                  value={formData.ttsVoice}
                  onChange={(e) => handleChange("ttsVoice", e.target.value)}
                  onBlur={() => handleBlur("ttsVoice")}
                  placeholder={DEFAULT_SETTINGS.ttsVoice}
                />
                {touched.ttsVoice && errors.ttsVoice && (
                  <p className="text-xs text-destructive mt-1">{errors.ttsVoice}</p>
                )}
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
                  onBlur={() => handleBlur("promptExecutiveSummary")}
                  rows={4}
                  placeholder="Enter prompt template..."
                />
                {touched.promptExecutiveSummary && errors.promptExecutiveSummary && (
                  <p className="text-xs text-destructive mt-1">{errors.promptExecutiveSummary}</p>
                )}
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
                  onBlur={() => handleBlur("promptDistilledSummary")}
                  rows={4}
                  placeholder="Enter prompt template..."
                />
                {touched.promptDistilledSummary && errors.promptDistilledSummary && (
                  <p className="text-xs text-destructive mt-1">{errors.promptDistilledSummary}</p>
                )}
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
