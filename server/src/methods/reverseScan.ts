import { mindstudio, auth, stream, getContextIp, getContextAnonToken } from '../runtime';
import { Users } from './tables/users';
import { VOICE_RULES, DEPTH_GUIDANCE, type Depth } from './common/voice';
import {
  resolveIdentity,
  getCounters,
  computeImageAllowance,
  incrementImageCount,
} from '../usage/guardrails';
import { logEvent, SCAN_STARTED, SCAN_SUCCEEDED, SCAN_FAILED } from '../observability/events';

interface ScanResult {
  name: string;
  kind: 'wine' | 'beer' | 'spirits';
  producer: string | null;
  region: string | null;
  vintage: number | null;
  abv: number | null;
  expect: string;
  monocleAside: string | null;
  pairings: string[];
  valueNote: string;
  occasion: string;
  confidence: 'high' | 'medium' | 'low';
  imagePrompt?: string; // model-supplied; consumed before return
  photoUrl?: string;
  notice?: 'daily_limit' | 'images_unavailable';
}

interface ReverseScanInput {
  imageUrl?: string;
  text?: string;
  depth?: Depth;
}

// Reverse Scan. Takes a photo of a bottle (or a typed name) and returns a
// single editorial card identifying the drink + a chiaroscuro portrait.
export async function reverseScan(input: ReverseScanInput): Promise<ScanResult> {
  const depth: Depth = input.depth || 'enthusiast';
  const userText = (input.text || '').trim();
  const imageUrl = input.imageUrl?.trim();

  if (!userText && !imageUrl) {
    throw new Error('Show me a bottle, or type a name. Anything will do.');
  }

  logEvent(SCAN_STARTED, { method: 'reverseScan', identityType: auth.userId ? 'user' : 'anon' });

  try {
    let tasteSummary: string | undefined;
    if (auth.userId) {
      const me = await Users.get(auth.userId);
      if (me?.tasteSummary) tasteSummary = me.tasteSummary;
    }

    await stream({ status: imageUrl ? 'Reading the label...' : 'Considering...' });

    const exampleOutput: ScanResult = {
      name: 'Domaine Tempier Bandol Rouge',
      kind: 'wine',
      producer: 'Domaine Tempier',
      region: 'Bandol, Provence, France',
      vintage: 2020,
      abv: 13.5,
      expect:
        'A wild, savory red with serious tannic structure and notes of garrigue, dried herbs, and warm earth. Built for richer fare, not Tuesday salads.',
      monocleAside: 'Evocative of the garrigue at high noon, if one must say so.',
      pairings: ['Lamb', 'Wild mushroom risotto', 'Aged cheese', 'Slow-braised short rib'],
      valueNote: 'Steady at $55. A serious pour for the price.',
      occasion: 'Sunday dinner with people who care.',
      confidence: 'high',
      imagePrompt:
        'Editorial chiaroscuro portrait of a Domaine Tempier Bandol Rouge 2020 wine bottle. Single subject in warm raking candlelight from upper left. Deep espresso black background, vignetting to pure black at edges. Shallow depth of field. Subtle film grain.',
    };

    const scanPrompt = `You are SommSavvy, a pocket sommelier doing a "Reverse Scan" on a single drink the user has placed in front of you.

${VOICE_RULES}

${DEPTH_GUIDANCE[depth]}

${tasteSummary ? `User's taste profile (light context only, do not change the answer):\n${tasteSummary}` : ''}

<input>
${userText ? `User hint: "${userText}"` : 'No additional context from the user.'}
${imageUrl ? 'A photo of the bottle is attached. Read the label carefully — producer, vintage, region, ABV, classification, etc. Multilingual labels are common.' : 'No photo provided. Identify based on the user hint alone.'}
</input>

Identify the drink and write a single editorial card. Return ONLY a JSON object with these fields:
- name: canonical drink name as it should appear on the card
- kind: "wine" | "beer" | "spirits"
- producer: producer name or null
- region: region or null
- vintage: integer year or null
- abv: percent or null
- expect: 2-3 sentences in the depth-appropriate voice covering taste and feel (NEVER use em dashes)
- monocleAside: one-sentence faux-snobby aside, or null. Include on roughly half of scans, not every time.
- pairings: 3-5 short strings
- valueNote: one sentence, honest. Tell the truth about price-vs-quality.
- occasion: one short sentence framing when to open this.
- confidence: "high" | "medium" | "low" — how certain you are
- imagePrompt: a one-paragraph image-gen prompt for an editorial chiaroscuro portrait of this exact bottle. Always include: "Editorial chiaroscuro portrait of [specific bottle name and vintage]. Single subject in warm raking candlelight from upper left. Deep espresso black background, vignetting to pure black at edges. Shallow depth of field. Subtle film grain. Atmospheric, restrained, magazine editorial."

If you cannot identify the drink, set confidence to "low" and use "expect" to describe what you CAN see (a red wine in a Burgundy bottle, a stout in a 16oz can) and ask the user to try a clearer angle.

No prose, no markdown fences. Only the JSON object.`;

    let result: ScanResult;
    try {
      if (imageUrl) {
        // Vision path: analyzeImage returns the structured JSON in one call.
        const { analysis } = await mindstudio.analyzeImage({
          prompt: scanPrompt,
          imageUrl,
        });
        result = parseJsonLoosely<ScanResult>(analysis);
      } else {
        // Text-only path: generateText with Claude Haiku.
        const { content } = await mindstudio.generateText({
          message: scanPrompt,
          modelOverride: {
            temperature: 0.5,
            maxResponseTokens: 2000,
          },
          structuredOutputType: 'json',
          structuredOutputExample: JSON.stringify(exampleOutput),
        });
        result = typeof content === 'string' ? JSON.parse(content) : (content as ScanResult);
      }
    } catch (err) {
      console.error('reverseScan identification failed:', err);
      throw new Error('Could not place this one. Try a clearer label?');
    }

    // Stream the text card NOW so the frontend can navigate to /result.
    const { imagePrompt: _earlyPrompt, ...earlyResult } = result;
    await stream({ partialResult: earlyResult });

    // --- Image allowance check ---
    const ip = getContextIp();
    const anonToken = getContextAnonToken();
    const identity = resolveIdentity(auth.userId, anonToken, ip);
    const counters = await getCounters(identity.primary, identity.ipKey);
    const { allowed, notice } = computeImageAllowance(counters, identity.isSignedIn, 1);

    if (notice) {
      result.notice = notice;
    }

    // Generate the bottle portrait only if allowed and confidence is sufficient.
    if (allowed > 0 && result.confidence !== 'low') {
      await stream({ status: 'Pouring...' });
      try {
        const portraitPrompt =
          result.imagePrompt ||
          `Editorial chiaroscuro portrait of a ${result.kind} bottle of ${result.producer ?? result.name}${result.vintage ? ' ' + result.vintage : ''}. Single subject in warm raking candlelight from upper left. Deep espresso black background, vignetting to pure black at edges. Shallow depth of field. Subtle film grain. Atmospheric, restrained, magazine editorial.`;
        const { imageUrl: portrait } = await mindstudio.generateImage({
          prompt: portraitPrompt,
          imageModelOverride: {
            config: {
              aspect_ratio: '3:4',
            },
          },
        });
        result.photoUrl = Array.isArray(portrait) ? portrait[0] : portrait;

        // Only increment on successful generation.
        await incrementImageCount(identity.primary, identity.ipKey, 1);
      } catch (err) {
        // Provider failure: do NOT increment counters.
        console.error('Bottle portrait failed (non-fatal):', err);
      }
    }

    // Strip the working field before returning.
    const { imagePrompt, ...publicResult } = result;

    logEvent(SCAN_SUCCEEDED, { method: 'reverseScan' });
    return publicResult;
  } catch (err) {
    const reason =
      err instanceof Error && err.message.includes('Try a clearer')
        ? 'provider_error'
        : 'input_error';
    logEvent(SCAN_FAILED, { method: 'reverseScan', reason });
    throw err;
  }
}

// Parse JSON that the model may have wrapped in fences or surrounding prose.
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
