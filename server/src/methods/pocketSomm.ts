import { mindstudio, auth, stream } from '../runtime';
import { Users } from './tables/users';
import { VOICE_RULES, DEPTH_GUIDANCE, type Depth } from './common/voice';

interface Recommendation {
  name: string;
  kind: 'wine' | 'beer' | 'spirits';
  producer: string | null;
  region: string | null;
  vintage: number | null;
  abv: number | null;
  why: string;
  monocleAside: string | null;
  priceTier: '$' | '$$' | '$$$' | '$$$$';
  pairings: string[];
  imagePrompt?: string; // model-supplied; consumed before return
  photoUrl?: string;
}

interface PocketSommInput {
  imageUrl?: string;
  text?: string;
  depth?: Depth;
  category?: 'wine' | 'beer' | 'spirits' | 'any';
}

interface PocketSommOutput {
  summary: string;
  recommendations: Recommendation[];
}

// Pocket Somm. Takes a photo, text, or transcribed voice. Returns 3-4
// editorial drink recommendations with chiaroscuro card photos for each.
//
//   1. Analyze the image with Gemini Flash vision (if a photo is present)
//   2. Generate recommendations with Claude Haiku + structured JSON
//   3. Generate card images in parallel with the Gemini image model
export async function pocketSomm(input: PocketSommInput): Promise<PocketSommOutput> {
  const depth: Depth = input.depth || 'enthusiast';
  const category = input.category || 'any';
  const userText = (input.text || '').trim();
  const imageUrl = input.imageUrl?.trim();

  if (!userText && !imageUrl) {
    throw new Error('Show me a photo, type a question, or speak. Anything will do.');
  }

  // Pull the signed-in user's taste summary for soft context.
  let tasteSummary: string | undefined;
  if (auth.userId) {
    const me = await Users.get(auth.userId);
    if (me?.tasteSummary) tasteSummary = me.tasteSummary;
  }

  await stream({ status: imageUrl ? 'Reading the room...' : 'Considering...' });

  // Phase 1: extract context from the photo if present.
  let visualContext = '';
  if (imageUrl) {
    try {
      const { analysis } = await mindstudio.analyzeImage({
        prompt: `You are an expert sommelier looking at a photo from a user. Describe in detail:
1. Any food, dishes, ingredients, or dining context visible.
2. Any beverages already in frame.
3. The implied occasion or setting (casual dinner, celebration, restaurant, picnic, etc.).
4. Cuisine type or flavor profile suggested.

Be concrete and specific — your description drives drink pairings. No hedging, no "appears to be." If it is a menu, transcribe the relevant items.`,
        imageUrl,
      });
      visualContext = analysis;
    } catch (err) {
      console.error('analyzeImage failed (continuing without):', err);
    }
  }

  await stream({ status: 'Considering pairings...' });

  // Phase 2: generate the recommendations as structured JSON.
  const exampleOutput: PocketSommOutput = {
    summary: 'Three pours that all earn their place at this table.',
    recommendations: [
      {
        name: 'Sancerre',
        kind: 'wine',
        producer: 'Pascal Jolivet',
        region: 'Loire Valley, France',
        vintage: 2022,
        abv: 13.0,
        why: 'The flint and citrus profile cuts the richness of a buttery sauce without overpowering anything green on the plate.',
        monocleAside: 'One detects, of course, the unmistakable suggestion of wet stone.',
        priceTier: '$$',
        pairings: ['Goat cheese', 'Grilled fish', 'Herbed chicken'],
        imagePrompt:
          'Editorial chiaroscuro portrait of a Sancerre wine bottle by Pascal Jolivet, 2022 vintage. Single subject in warm raking candlelight from upper left. Deep espresso black background, vignetting to pure black at edges. Shallow depth of field. Subtle film grain.',
      },
    ],
  };

  const sommPrompt = `You are SommSavvy, a pocket sommelier for wine, beer, and spirits.

${VOICE_RULES}

${DEPTH_GUIDANCE[depth]}

${tasteSummary ? `User's taste profile (soft context, never override an explicit request):\n${tasteSummary}` : 'No taste profile yet (new user).'}

${category && category !== 'any' ? `Constraint: only recommend drinks in this category: ${category}.` : 'Wine, beer, or spirits are all fair game. Pick the best fit for the situation.'}

<situation>
${userText ? `User said: "${userText}"` : 'No words from the user.'}
${visualContext ? `Photo analysis: ${visualContext}` : 'No photo provided.'}
</situation>

Recommend three or four drinks for this situation. For each one, return:
- name: the drink's canonical name
- kind: "wine" | "beer" | "spirits"
- producer: producer name or null
- region: region or null
- vintage: integer year or null
- abv: percent like 13.5 or null
- why: one to three sentences explaining the fit, in the depth-appropriate voice (NEVER use em dashes here)
- monocleAside: optional one-sentence faux-snobby aside, or null. Use on AT MOST one of the four recommendations. Never on all of them.
- priceTier: "$" | "$$" | "$$$" | "$$$$"
- pairings: 2-4 short strings
- imagePrompt: a one-paragraph image generation prompt for an editorial chiaroscuro portrait of the bottle. Always include: "Editorial chiaroscuro portrait of [the specific bottle]. Single subject in warm raking candlelight from upper left. Deep espresso black background, vignetting to pure black at edges. Shallow depth of field. Subtle film grain. Atmospheric, restrained, magazine editorial. No glossy product photography. No e-commerce stock."

Also include a "summary" field: a single italic-quotable sentence (no em dashes).

Return ONLY a JSON object matching the example. No prose, no markdown fences.`;

  // Try Haiku, then retry once on failure.
  const callHaiku = async () => {
    const { content } = await mindstudio.generateText({
      message: sommPrompt,
      modelOverride: {
        temperature: 0.7,
        maxResponseTokens: 4000,
      },
      structuredOutputType: 'json',
      structuredOutputExample: JSON.stringify(exampleOutput),
    });
    return typeof content === 'string'
      ? (JSON.parse(content) as PocketSommOutput)
      : (content as PocketSommOutput);
  };

  let parsed: PocketSommOutput;
  try {
    parsed = await callHaiku();
  } catch (err) {
    console.error('pocketSomm generateText failed (retrying once):', err);
    try {
      parsed = await callHaiku();
    } catch (retryErr) {
      console.error('pocketSomm generateText failed on retry:', retryErr);
      throw new Error('The somm is taking a moment. Try again?');
    }
  }

  const recs = parsed.recommendations || [];
  if (recs.length === 0) {
    throw new Error('Could not find a fit for that. Try a clearer prompt or photo?');
  }

  // Stream the text result NOW so the frontend can navigate to /result and
  // show the recommendation cards with image placeholders, while we finish
  // generating the actual chiaroscuro photos.
  const textOnlyRecs: Recommendation[] = recs.map((r) => {
    const { imagePrompt, ...rest } = r;
    return rest;
  });
  await stream({
    partialResult: {
      summary: parsed.summary || 'Three pours, considered.',
      recommendations: textOnlyRecs,
    },
  });

  await stream({ status: 'Pouring three glasses...' });

  // Phase 3: generate chiaroscuro bottle images in parallel.
  const photos: (string | null)[] = recs.map(() => null);
  try {
    const batch = await mindstudio.executeStepBatch(
      recs.map((r) => ({
        stepType: 'generateImage' as const,
        step: {
          prompt:
            r.imagePrompt ||
            `Editorial chiaroscuro portrait of a ${r.kind} bottle of ${r.producer ?? r.name}${r.vintage ? ' ' + r.vintage : ''}. Single subject in warm raking candlelight. Deep espresso black background. Atmospheric, restrained, magazine editorial.`,
          imageModelOverride: {
            config: {
              aspect_ratio: '3:4',
            },
          },
        },
      })),
    );
    for (let i = 0; i < batch.results.length; i++) {
      const r = batch.results[i]!;
      if (r.error) {
        console.error('Photo gen failed for one rec:', r.error);
        continue;
      }
      const out = r.output as { imageUrl?: string | string[] } | undefined;
      const url = out?.imageUrl;
      photos[i] = Array.isArray(url) ? url[0] ?? null : url ?? null;
    }
  } catch (err) {
    console.error('Photo batch failed entirely (continuing without photos):', err);
  }

  // Strip the imagePrompt working field from the response shape.
  const enriched: Recommendation[] = recs.map((r, i) => {
    const { imagePrompt, ...rest } = r;
    return { ...rest, photoUrl: photos[i] ?? undefined };
  });

  return {
    summary: parsed.summary || 'Three pours, considered.',
    recommendations: enriched,
  };
}
