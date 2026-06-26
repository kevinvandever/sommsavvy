import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI, { toFile } from 'openai';
import { config } from '../config';
import { getStorage, extForContentType } from '../storage';

// AI provider layer. Replaces the `mindstudio.*` calls from the platform with
// direct provider SDKs:
//   - analyzeImage      -> Gemini Flash (vision)
//   - generateText      -> Anthropic Claude Haiku (with JSON coercion)
//   - generateImage     -> Gemini image model (Nano Banana), stored to blob storage
//   - executeStepBatch  -> parallel generateImage
//   - transcribeAudio   -> OpenAI transcription
//
// The exported `mindstudio` object keeps the same method shapes the ported
// SommSavvy methods already call, so those files barely change.

// ---- Lazy clients (constructed on first use, fail clearly if key missing) ----

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set.');
  return (_anthropic ??= new Anthropic({ apiKey: config.anthropicApiKey }));
}

let _gemini: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY is not set.');
  return (_gemini ??= new GoogleGenAI({ apiKey: config.geminiApiKey }));
}

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY is not set.');
  return (_openai ??= new OpenAI({ apiKey: config.openaiApiKey }));
}

// ---- Helpers ----

async function fetchAsBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

// Extract a JSON value from a model response that may be wrapped in code
// fences or surrounded by stray prose.
function parseJsonLoosely(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]!);
    } catch {
      /* fall through */
    }
  }
  const brace = trimmed.match(/[[{][\s\S]*[\]}]/);
  if (brace) return JSON.parse(brace[0]);
  throw new Error('Could not parse model output as JSON');
}

// ---- Public types (kept stable for the ported methods) ----

export interface AnalyzeImageArgs {
  prompt: string;
  imageUrl: string;
  visionModelOverride?: { model?: string };
}

export interface GenerateTextArgs {
  message: string;
  modelOverride?: { model?: string; temperature?: number; maxResponseTokens?: number };
  structuredOutputType?: 'json';
  structuredOutputExample?: string;
}

export interface GenerateImageArgs {
  prompt: string;
  imageModelOverride?: { model?: string; config?: Record<string, unknown> };
}

export interface BatchStep {
  stepType: 'generateImage';
  step: GenerateImageArgs;
}

export interface TranscribeAudioArgs {
  audioUrl: string;
  prompt?: string;
  transcriptionModelOverride?: { model: string };
}

// ---- Implementation ----

export const mindstudio = {
  // Vision: read a photo and answer the prompt. Used for menu/scene reading
  // and label identification. Model ids from platform overrides are ignored
  // in favor of the configured current model.
  async analyzeImage(args: AnalyzeImageArgs): Promise<{ analysis: string }> {
    const { buffer, contentType } = await fetchAsBuffer(args.imageUrl);
    const mimeType = contentType.startsWith('image/') ? contentType : 'image/jpeg';
    const res = await gemini().models.generateContent({
      model: config.models.vision,
      contents: [
        {
          role: 'user',
          parts: [
            { text: args.prompt },
            { inlineData: { mimeType, data: buffer.toString('base64') } },
          ],
        },
      ],
    });
    return { analysis: res.text ?? '' };
  },

  // Text generation. When structuredOutputType is 'json', returns a parsed
  // object in `content`; otherwise returns the raw text string.
  async generateText(args: GenerateTextArgs): Promise<{ content: string | unknown }> {
    const wantsJson = args.structuredOutputType === 'json';
    const system = wantsJson
      ? [
          'You output only raw JSON with no markdown code fences and no surrounding prose.',
          args.structuredOutputExample
            ? `Match the shape of this example exactly:\n${args.structuredOutputExample}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      : undefined;

    const res = await anthropic().messages.create({
      model: config.models.text,
      max_tokens: args.modelOverride?.maxResponseTokens ?? 4096,
      temperature: args.modelOverride?.temperature ?? 0.7,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: args.message }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    if (wantsJson) return { content: parseJsonLoosely(text) };
    return { content: text };
  },

  // Image generation via Gemini (Nano Banana). Decodes the returned bytes and
  // persists them to blob storage, returning a public URL.
  async generateImage(args: GenerateImageArgs): Promise<{ imageUrl: string | string[] }> {
    const aspectRatio =
      (args.imageModelOverride?.config?.aspect_ratio as string | undefined) ?? '3:4';
    const res = await gemini().models.generateContent({
      model: config.models.image,
      contents: args.prompt,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio },
      },
    });

    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      throw new Error('Image generation returned no image data.');
    }
    const mimeType = imagePart.inlineData.mimeType ?? 'image/png';
    const bytes = Buffer.from(imagePart.inlineData.data, 'base64');
    const stored = await getStorage().put(bytes, mimeType, extForContentType(mimeType));
    return { imageUrl: stored.url };
  },

  // Run several generateImage steps in parallel, preserving order and
  // isolating per-item failures.
  async executeStepBatch(
    steps: BatchStep[],
  ): Promise<{ results: { output?: { imageUrl?: string | string[] }; error?: unknown }[] }> {
    const results = await Promise.all(
      steps.map(async (s) => {
        try {
          const out = await this.generateImage(s.step);
          return { output: { imageUrl: out.imageUrl } };
        } catch (error) {
          return { error };
        }
      }),
    );
    return { results };
  },

  // Transcription via OpenAI. Accepts webm/mp4/mp3 directly, so no remuxing
  // step is needed.
  async transcribeAudio(args: TranscribeAudioArgs): Promise<{ text: string }> {
    const { buffer, contentType } = await fetchAsBuffer(args.audioUrl);
    const ext = extForContentType(contentType);
    const file = await toFile(buffer, `audio.${ext}`, { type: contentType });
    const res = await openai().audio.transcriptions.create({
      file,
      model: config.models.transcribe,
      ...(args.prompt ? { prompt: args.prompt } : {}),
    });
    return { text: (res.text ?? '').trim() };
  },
};
