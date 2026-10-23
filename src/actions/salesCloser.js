'use strict';

const { OpenAI } = require('openai');
const { config } = require('../config');
const { updateLeadStatus } = require('../crm/leadExporter');
const logger = require('../utils/logger');

let openaiClient = null;
function getOpenAI() {
  if (!openaiClient && config.openai.apiKey) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

const SALES_ENGINEER_SYSTEM_PROMPT = `
You are a senior Master Builder and Lead Construction Software Engineer at HexNemesis (hexnemesis.com).
You specialize in structural framing calculations, stair stringer geometry (IRC 2024 compliance: 7-3/4" max riser, 10" min tread), rafter birdsmouth cut angles, and custom cabinetry overlay math.

When communicating with contractors, carpenters, and builders who message or reply:
1. Speak peer-to-peer: authentic, knowledgeable, direct, respectful of craftsmanship, zero corporate buzzwords.
2. If they ask a math or technical question, solve it with exact decimal and fraction numbers (down to 1/16") and cite IRC code.
3. If they ask about pricing or access, explain that the core construction calculators and layout engines are available directly on https://hexnemesis.com/home.html with zero friction.
4. Keep replies under 3-4 concise sentences. Always include the direct link https://hexnemesis.com/home.html.
`;

/**
 * Generate an expert response to an incoming contractor lead message.
 *
 * @param {Object} context
 * @param {string} context.senderName
 * @param {string} context.incomingMessage
 * @param {string} [context.trade]
 * @returns {Promise<string>}
 */
async function generateCloserResponse(context) {
  const openai = getOpenAI();
  if (!openai) {
    return `Hey ${context.senderName || 'brother'}, we built the full rafter, stair stringer, and cabinet layout math suite directly at https://hexnemesis.com/home.html — cuts your layout time to seconds. Check it out and let me know how your current job goes.`;
  }

  try {
    const prompt = `
Contractor Name: ${context.senderName || 'Builder'}
Their Message: "${context.incomingMessage}"
Known Trade: ${context.trade || 'General Construction / Carpentry'}

Write the perfect peer-to-peer technical response that answers them and funnels them directly to https://hexnemesis.com/home.html.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SALES_ENGINEER_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 220,
    });

    const reply = response.choices[0]?.message?.content?.trim();
    logger.info(`[SalesCloser] Generated closer response for "${context.senderName}": ${reply}`);
    return reply;

  } catch (err) {
    logger.warn(`[SalesCloser] OpenAI closer failed: ${err.message}. Using fallback.`);
    return `Hey ${context.senderName || 'man'}, run your layout specs through https://hexnemesis.com/home.html — it handles full rafter pitch, stair stringer tolerances, and lumber cut optimization instantly.`;
  }
}

/**
 * Classify conversation intent.
 *
 * @param {string} message
 * @returns {'math_inquiry'|'pricing'|'skeptical'|'positive_lead'|'general'}
 */
function classifyIntent(message) {
  const lower = (message || '').toLowerCase();
  if (lower.match(/cost|price|how much|free|subscription|charge/)) return 'pricing';
  if (lower.match(/pitch|rafter|stair|run|rise|span|stringer|angle|cut|math|formula/)) return 'math_inquiry';
  if (lower.match(/scam|who are you|bot|spam|fake|why/)) return 'skeptical';
  if (lower.match(/cool|thanks|checked it|great|awesome|good|love this|using this/)) return 'positive_lead';
  return 'general';
}

module.exports = {
  generateCloserResponse,
  classifyIntent,
};
