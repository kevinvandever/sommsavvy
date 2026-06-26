import { mindstudio } from '../runtime';

interface TranscribeInput {
  audioUrl: string;
}

// Transcribe a recorded voice clip. The frontend's candle UI calls this when
// committing a recorded audio clip. OpenAI transcription accepts the browser's
// webm/mp4 MediaRecorder output directly, so no audio remuxing is needed
// (unlike the platform's ElevenLabs path, which required it).
export async function transcribeVoice(input: TranscribeInput) {
  if (!input.audioUrl?.trim()) {
    throw new Error('No audio.');
  }

  try {
    const { text } = await mindstudio.transcribeAudio({
      audioUrl: input.audioUrl,
      // Light domain hint nudges the model toward wine/beer/spirits vocabulary.
      prompt:
        'A user speaking casually about wine, beer, spirits, food, or what they are eating or drinking. Likely mentions producer names, regions, grape varieties, dish names.',
    });

    return { text: (text || '').trim() };
  } catch (err) {
    console.error('transcribeVoice failed:', err);
    throw new Error('Could not catch that. Try again, or type instead?');
  }
}
