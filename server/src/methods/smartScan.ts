import { mindstudio, auth, stream as defaultStream } from '../runtime';
import { Users } from './tables/users';
import { VOICE_RULES, DEPTH_GUIDANCE, type Depth } from './common/voice';
import { reverseScanInternal, type ScanResult } from './common/reverseScanInternal';
import { pocketSommInternal, type PocketSommOutput } from './common/pocketSommInternal';
import { logEvent, SCAN_STARTED, SCAN_SUCCEEDED, SCAN_FAILED } from '../observability/events';
import { parseSubjectClass, type SubjectClass } from '../ai';

// Re-export for consumers that already import SubjectClass from this module.
export type { SubjectClass };

/** Provider timeout in milliseconds (Requirements 5.3, 5.4). */
const PROVIDER_TIMEOUT_MS = 30_000;

/**
 * Race a promise against a 30-second timeout. If the timeout fires first,
 * throws a friendly error with no technical details or stack trace.
 */
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Taking too long. Please try again in a moment.'));
    }, PROVIDER_TIMEOUT_MS);

    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export interface SmartScanInput {
  imageUrl?: string;
  text?: string;
  depth?: Depth;
  forceMode?: 'identify' | 'pair';
}

export interface SmartScanResult {
  mode: 'identify' | 'pair';
  ambiguous: boolean;
  confidence: 'high' | 'medium' | 'low';
  data: ScanResult | PocketSommOutput;
}

/**
 * Thrown when a forceMode override is invoked but the captured context
 * (imageUrl / text) is no longer available. The frontend should catch this
 * specific error code and return the user to the multimodal entry surface
 * for a fresh capture (Requirement 3.6).
 */
export class ContextExpiredError extends Error {
  /** Machine-readable code the frontend can switch on. */
  readonly code = 'CONTEXT_EXPIRED' as const;

  constructor() {
    super('The original context has expired. Please capture again.');
    this.name = 'ContextExpiredError';
  }
}

// --- Classification prompt fragment ---

const CLASSIFICATION_INSTRUCTION = `
FIRST, classify the subject of this scan into exactly one of:
- "bottle-like": the subject is a wine, beer, or spirits bottle, label, can, or retail shelf display
- "pairing-like": the subject is a dish, meal, menu, food, ingredient, or a scene where the user wants drink recommendations
- "ambiguous": you cannot confidently decide between the above two categories
- "none": the image or text is unreadable, empty, or has no discernible food/drink subject

Return your classification in a "subjectClass" field at the top level of your JSON response.
`;

/**
 * smartScan - the unified scan entry point.
 *
 * Performs a single analysis pass that classifies the subject AND, for
 * bottle-like subjects, produces the full identification card in the same
 * response. For pairing-like subjects, delegates to pocketSommInternal which
 * does its own recommendation generation.
 *
 * This function is designed to be registered as an sseMethod route.
 */
export async function smartScan(input: SmartScanInput): Promise<SmartScanResult> {
  const imageUrl = input.imageUrl?.trim();
  const userText = (input.text || '').trim();
  const depth: Depth = input.depth || 'enthusiast';

  // When forceMode is set but context is missing, the frontend's session state
  // has expired. Return a distinguishable signal so the client can route back
  // to the multimodal entry surface for a fresh capture (Requirement 3.6).
  if (input.forceMode && !imageUrl && !userText) {
    throw new ContextExpiredError();
  }

  // Validate: at least one of imageUrl or text must be provided.
  if (!imageUrl && !userText) {
    throw new Error('Show me a photo, type a name, or speak. Anything will do.');
  }

  logEvent(SCAN_STARTED, { method: 'smartScan', identityType: auth.userId ? 'user' : 'anon' });

  try {
    // --- forceMode bypass: skip classification, delegate directly ---
    if (input.forceMode === 'identify') {
      // Emit routing metadata immediately so the frontend can render the
      // correct surface before the full card streams in.
      await defaultStream({
        partialResult: { mode: 'identify' as const, ambiguous: false, confidence: 'high' as const },
      });
      const scanResult = await withTimeout(
        reverseScanInternal({ imageUrl, text: userText, depth }),
        'reverseScan',
      );
      logEvent(SCAN_SUCCEEDED, { method: 'smartScan', route: 'identify', forced: true });
      return {
        mode: 'identify',
        ambiguous: false,
        confidence: scanResult.confidence,
        data: scanResult,
      };
    }

    if (input.forceMode === 'pair') {
      // Emit routing metadata immediately so the frontend can render the
      // correct surface before pairings stream in.
      await defaultStream({
        partialResult: { mode: 'pair' as const, ambiguous: false, confidence: 'high' as const },
      });
      const pairResult = await withTimeout(
        pocketSommInternal({ imageUrl, text: userText, depth }),
        'pocketSomm',
      );
      logEvent(SCAN_SUCCEEDED, { method: 'smartScan', route: 'pair', forced: true });
      return {
        mode: 'pair',
        ambiguous: false,
        confidence: 'high',
        data: pairResult,
      };
    }

    // --- Single-pass classification + card generation ---

    // Pull the signed-in user's taste summary for soft context.
    let tasteSummary: string | undefined;
    if (auth.userId) {
      const me = await Users.get(auth.userId);
      if (me?.tasteSummary) tasteSummary = me.tasteSummary;
    }

    await defaultStream({ status: imageUrl ? 'Reading...' : 'Considering...' });

    // Build the unified analysis prompt that classifies AND produces card fields
    // for bottle-like subjects in a single pass.
    const exampleOutput = {
      subjectClass: 'bottle-like' as SubjectClass,
      name: 'Domaine Tempier Bandol Rouge',
      kind: 'wine' as const,
      producer: 'Domaine Tempier',
      region: 'Bandol, Provence, France',
      vintage: 2020,
      abv: 13.5,
      expect:
        'A wild, savory red with serious tannic structure and notes of garrigue, dried herbs, and warm earth.',
      monocleAside: 'Evocative of the garrigue at high noon, if one must say so.',
      pairings: ['Lamb', 'Wild mushroom risotto', 'Aged cheese'],
      valueNote: 'Steady at $55. A serious pour for the price.',
      occasion: 'Sunday dinner with people who care.',
      confidence: 'high' as const,
      imagePrompt:
        'Editorial chiaroscuro portrait of a Domaine Tempier Bandol Rouge 2020 wine bottle. Single subject in warm raking candlelight from upper left. Deep espresso black background, vignetting to pure black at edges. Shallow depth of field. Subtle film grain.',
    };

    const analysisPrompt = `You are SommSavvy, a pocket sommelier for wine, beer, and spirits.

${CLASSIFICATION_INSTRUCTION}

${VOICE_RULES}

${DEPTH_GUIDANCE[depth]}

${tasteSummary ? `User's taste profile (light context only, do not change the answer):\n${tasteSummary}` : ''}

<input>
${userText ? `User said: "${userText}"` : 'No additional context from the user.'}
${imageUrl ? 'A photo is attached. Examine it carefully.' : 'No photo provided.'}
</input>

INSTRUCTIONS:
1. Classify the subject into "subjectClass" as described above.
2. IF subjectClass is "bottle-like", "ambiguous", or "none": also fill the identification card fields (name, kind, producer, region, vintage, abv, expect, monocleAside, pairings, valueNote, occasion, confidence, imagePrompt). For "none" or unreadable subjects, set confidence to "low" and describe what you CAN see in the "expect" field.
3. IF subjectClass is "pairing-like": return ONLY { "subjectClass": "pairing-like", "context": "<one paragraph describing the food/scene/menu visible>" }. Do NOT generate card fields for pairing-like subjects.

For identification card fields when applicable:
- name: canonical drink name
- kind: "wine" | "beer" | "spirits"
- producer: producer name or null
- region: region or null
- vintage: integer year or null
- abv: percent or null
- expect: 2-3 sentences in the depth-appropriate voice (NEVER use em dashes)
- monocleAside: one-sentence faux-snobby aside, or null (use sparingly)
- pairings: 3-5 short strings
- valueNote: one sentence, honest
- occasion: one short sentence
- confidence: "high" | "medium" | "low"
- imagePrompt: one-paragraph editorial chiaroscuro portrait prompt. Always include: "Editorial chiaroscuro portrait of [specific bottle]. Single subject in warm raking candlelight from upper left. Deep espresso black background, vignetting to pure black at edges. Shallow depth of field. Subtle film grain. Atmospheric, restrained, magazine editorial."

Return ONLY a JSON object. No prose, no markdown fences.`;

    let parsed: Record<string, unknown>;

    try {
      if (imageUrl) {
        // Vision path: analyzeImage returns the structured JSON in one call.
        const { analysis } = await withTimeout(
          mindstudio.analyzeImage({ prompt: analysisPrompt, imageUrl }),
          'analyzeImage',
        );
        parsed = parseJsonLoosely<Record<string, unknown>>(analysis);
      } else {
        // Text-only path: generateText with structured JSON.
        const { content } = await withTimeout(
          mindstudio.generateText({
            message: analysisPrompt,
            modelOverride: {
              temperature: 0.5,
              maxResponseTokens: 3000,
            },
            structuredOutputType: 'json',
            structuredOutputExample: JSON.stringify(exampleOutput),
          }),
          'generateText',
        );
        parsed =
          typeof content === 'string'
            ? JSON.parse(content)
            : (content as Record<string, unknown>);
      }
    } catch (err) {
      console.error('smartScan analysis failed:', err);
      throw new Error('Could not read that. Try a clearer photo or type a name?');
    }

    // --- Route based on subjectClass ---
    const subjectClass = parseSubjectClass(parsed.subjectClass);

    if (subjectClass === 'pairing-like') {
      // Emit routing metadata so the frontend renders the pairings surface
      // before pocketSommInternal streams its own partialResult.
      await defaultStream({
        partialResult: { mode: 'pair' as const, ambiguous: false, confidence: 'high' as const },
      });
      await defaultStream({ status: 'Considering pairings...' });

      const contextDescription =
        typeof parsed.context === 'string' ? parsed.context : '';

      const pairResult = await withTimeout(
        pocketSommInternal({
          imageUrl,
          text: contextDescription || userText,
          depth,
        }),
        'pocketSomm',
      );

      logEvent(SCAN_SUCCEEDED, { method: 'smartScan', route: 'pair', subjectClass });
      return {
        mode: 'pair',
        ambiguous: false,
        confidence: 'high',
        data: pairResult,
      };
    }

    // --- Unrecognized subject (subjectClass === 'none') ---
    // No recognizable subject: return a recoverable message offering retake-photo
    // and typed-name. No card returned, no image counter increment.
    // (Requirements 5.1, 5.2)
    if (subjectClass === 'none') {
      throw new Error(
        'Could not make out a bottle, label, or dish. Try a clearer photo or type the name instead.',
      );
    }

    // bottle-like or ambiguous -> identification path
    // The analysis already returned the card fields; delegate to reverseScanInternal
    // which handles portrait generation, streaming, and guardrails.
    const isAmbiguous = subjectClass === 'ambiguous';

    // Use the confidence from the classification pass if available; default to
    // 'medium' for ambiguous/none where the model did not commit.
    const classificationConfidence: 'high' | 'medium' | 'low' =
      parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
        ? (parsed.confidence as 'high' | 'medium' | 'low')
        : isAmbiguous
          ? 'low'
          : 'medium';

    // Emit routing metadata so the frontend renders the identification surface
    // (and a prominent override action when ambiguous) before the card streams.
    await defaultStream({
      partialResult: { mode: 'identify' as const, ambiguous: isAmbiguous, confidence: classificationConfidence },
    });

    const scanResult = await withTimeout(
      reverseScanInternal({
        imageUrl,
        text: userText,
        depth,
      }),
      'reverseScan',
    );

    logEvent(SCAN_SUCCEEDED, { method: 'smartScan', route: 'identify', subjectClass });
    return {
      mode: 'identify',
      ambiguous: isAmbiguous,
      confidence: scanResult.confidence,
      data: scanResult,
    };
  } catch (err) {
    logEvent(SCAN_FAILED, { method: 'smartScan' });
    throw err;
  }
}

// --- Helpers ---

/**
 * Parse JSON that the model may have wrapped in fences or surrounding prose.
 */
function parseJsonLoosely<T>(raw: string): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* fall through */
  }
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1]!) as T;
  }
  const braceMatch = trimmed.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    return JSON.parse(braceMatch[0]) as T;
  }
  throw new Error('Could not parse model output as JSON');
}
