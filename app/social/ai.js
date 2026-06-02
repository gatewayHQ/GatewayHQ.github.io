// app/social/ai.js
// Generates a ready-to-paste social caption + hashtags via Claude (vision-aware
// when a photo is present), through the shared proxy. Tone adapts per platform.

export async function writeCaption({ platform, type, data, photoDataUrl }) {
  const api = window.GatewayAPI;
  if (!api || !api.claude) throw new Error('AI not available — sign in via ☁ Sync, or have your admin set up the team key.');

  const facts = [
    data.kicker && 'Post type: ' + data.kicker,
    data.title && 'Headline: ' + data.title,
    data.subtitle && 'Details: ' + data.subtitle,
    (data.stats || []).length && 'Key figures: ' + data.stats.map((s) => `${s.value} ${s.label}`.trim()).join(', '),
    (data.agents || []).length && 'Agent(s): ' + data.agents.map((a) => a.name).join(' & '),
    data.brokerage && 'Brokerage: ' + data.brokerage,
  ].filter(Boolean).join('\n');

  const isLinkedIn = platform === 'LinkedIn';
  const system = 'You are a top-performing real estate social media copywriter who writes scroll-stopping, authentic captions.';
  const prompt =
    `Write a ready-to-post ${platform} caption for this ${type} real estate post.\n\n${facts}\n\n` +
    `Rules:\n- Open with an attention-grabbing first line.\n- 1-3 short sentences of body.\n- End with a clear call to action.\n` +
    `- Final line: ${isLinkedIn ? '3-5 professional' : '6-10'} relevant hashtags.\n` +
    `- Tone: ${isLinkedIn ? 'polished and professional, no emojis.' : 'energetic and engaging with a few tasteful emojis.'}\n` +
    `Reply with ONLY the caption text — no preamble, no quotes.`;

  const images = photoDataUrl ? [photoDataUrl] : [];
  const text = await api.claude(system, prompt, { images, max_tokens: 400 });
  return (text || '').trim();
}
