// app/social/ai.js
// Generates a ready-to-paste social caption + hashtags via Claude (vision-aware
// when a photo is present), through the shared proxy. Tone adapts per platform.
// Compliance rules (Fair Housing, no unsourced superlatives, brokerage name)
// are part of the system prompt so every caption follows them.

export const CAPTION_RULES = [
  'Fair Housing: describe the PROPERTY, never the buyer, renter or neighbors. Do not say who the home is "ideal", "perfect" or "great" for.',
  'Never use: "ideal for families", "family-friendly", "perfect for singles", "empty nesters", "adult community", "exclusive", "safe neighborhood", "walking distance to church", or any wording about race, color, religion, national origin, sex, disability, familial status, age or other protected class.',
  'No unsubstantiated superlatives or rankings ("best", "#1", "top agent", "most", "lowest price") unless the facts below include a sourced claim — then cite it.',
  'Use only the facts provided. Never invent features, prices, dates, square footage or statistics.',
  'Mention the brokerage by its full name, "Gateway Real Estate Advisors" — never abbreviate it.',
];

export async function writeCaption({ platform, type, data, facts: factsText, photoDataUrl }) {
  const api = window.GatewayAPI;
  if (!api || !api.claude) throw new Error('AI not available — sign in via ☁ Sync, or have your admin set up the team key.');

  const facts = factsText || [
    data.kicker && 'Post type: ' + data.kicker,
    data.title && 'Headline: ' + data.title,
    data.subtitle && 'Details: ' + data.subtitle,
    (data.stats || []).length && 'Key figures: ' + data.stats.map((s) => `${s.value} ${s.label}`.trim()).join(', '),
    (data.agents || []).length && 'Agent(s): ' + data.agents.map((a) => a.name).join(' & '),
    'Brokerage: ' + (data.brokerage || 'Gateway Real Estate Advisors'),
  ].filter(Boolean).join('\n');

  const isLinkedIn = platform === 'LinkedIn';
  const system =
    'You are a real estate social media copywriter who writes clear, authentic captions for a licensed brokerage. ' +
    'You always follow these compliance rules:\n- ' + CAPTION_RULES.join('\n- ');
  const prompt =
    `Write a ready-to-post ${platform} caption for this ${type} real estate post.\n\n${facts}\n\n` +
    `Rules:\n- Open with an attention-grabbing first line.\n- 1-3 short sentences of body.\n- End with a clear call to action.\n` +
    `- Final line: ${isLinkedIn ? '3-5 professional' : '6-10'} relevant hashtags.\n` +
    `- Tone: ${isLinkedIn ? 'polished and professional, no emojis.' : 'warm and engaging with a few tasteful emojis.'}\n` +
    `- Follow every compliance rule in your instructions.\n` +
    `Reply with ONLY the caption text — no preamble, no quotes.`;

  const images = photoDataUrl ? [photoDataUrl] : [];
  const text = await api.claude(system, prompt, { images, max_tokens: 400 });
  return (text || '').trim();
}
