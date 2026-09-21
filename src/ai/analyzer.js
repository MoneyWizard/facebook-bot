'use strict';

const OpenAI = require('openai');
const { config } = require('../config');
const logger = require('../utils/logger');

let client;

function getClient() {
  if (!client) {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set. Add it to your .env file.');
    }
    client = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return client;
}

// ─── Built-in Analysis Modes ──────────────────────────────────────────────────

const MODES = {
  summarize: (profile) => ({
    systemPrompt: 'You are an expert at summarizing social media profiles concisely and accurately. Write in plain English.',
    userPrompt: `Summarize this Facebook profile in 3-4 sentences:\n\n${JSON.stringify(profile, null, 2)}`,
  }),

  categorize: (profile) => ({
    systemPrompt: 'You are an expert at inferring personal information from social media profiles. Respond in JSON format.',
    userPrompt: `Based on the following Facebook profile data, infer and return a JSON object with:
- estimatedAge (range)
- profession
- interests (array)
- education_level
- relationship_status_guess
- notable_traits (array)

Profile:\n${JSON.stringify(profile, null, 2)}`,
  }),

  privacy_audit: (profile) => ({
    systemPrompt: 'You are a privacy researcher identifying sensitive data exposures in social media profiles.',
    userPrompt: `Perform a privacy audit of the following Facebook profile. Identify any sensitive data points that are publicly visible and could pose a privacy risk. Format as a bullet list.\n\nProfile:\n${JSON.stringify(profile, null, 2)}`,
  }),

  sentiment: (profile) => ({
    systemPrompt: 'You are a sentiment analysis expert.',
    userPrompt: `Analyze the sentiment and emotional tone of the following Facebook posts. Provide an overall sentiment score (1-10, 1=very negative, 10=very positive) and a brief explanation.\n\nPosts:\n${JSON.stringify(profile.posts || [], null, 2)}`,
  }),
};

/**
 * Analyze a scraped profile using GPT-4o.
 *
 * @param {Object} profile  Scraped profile object from storage or scraper
 * @param {string} mode     One of: summarize | categorize | privacy_audit | sentiment | custom
 * @param {string} [customPrompt]  Used when mode === 'custom'
 * @returns {Promise<{result: string, usage: Object}>}
 */
async function analyzeProfile(profile, mode = 'summarize', customPrompt = null) {
  logger.info(`Analyzing profile "${profile.name || profile.url}" with mode="${mode}"`);

  const openai = getClient();

  let systemPrompt, userPrompt;

  if (mode === 'custom') {
    if (!customPrompt) throw new Error('customPrompt is required when mode is "custom"');
    systemPrompt = 'You are a helpful assistant analyzing Facebook profile data.';
    userPrompt = `${customPrompt}\n\nProfile Data:\n${JSON.stringify(profile, null, 2)}`;
  } else {
    const modeHandler = MODES[mode];
    if (!modeHandler) {
      throw new Error(`Unknown mode "${mode}". Valid modes: ${Object.keys(MODES).join(', ')}, custom`);
    }
    ({ systemPrompt, userPrompt } = modeHandler(profile));
  }

  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 1000,
  });

  const result = completion.choices[0]?.message?.content || '';
  const usage = completion.usage;

  logger.info(`Analysis complete — ${usage?.total_tokens || '?'} tokens used`);

  return { result, usage, mode, model: config.openai.model };
}

/**
 * List available analysis modes.
 */
function listModes() {
  return [...Object.keys(MODES), 'custom'];
}

module.exports = { analyzeProfile, listModes };
