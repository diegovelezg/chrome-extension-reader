import { Settings } from "../types";

export interface TTSOptions {
  input: string;
  voice?: string;
  speed?: number;
}

export class TTSClient {
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  updateSettings(settings: Settings) {
    this.settings = settings;
  }

  async synthesize(options: TTSOptions): Promise<ArrayBuffer> {
    const { ttsEndpoint, ttsVoice } = this.settings;
    const { input, voice, speed = 1.0 } = options;

    const response = await fetch(`${ttsEndpoint}/v1/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input,
        voice: voice || ttsVoice,
        speed,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS API error: ${response.status} - ${errorText}`);
    }

    return response.arrayBuffer();
  }
}

export function createTTSClient(settings: Settings): TTSClient {
  return new TTSClient(settings);
}