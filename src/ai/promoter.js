'use strict';

const OpenAI = require('openai');
const { config } = require('../config');
const { loadSiteKnowledge, inspectSite } = require('./siteInspector');
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

/**
 * Get site knowledge for hexnemesis.com (crawled via Playwright).
 */
async function getSiteKnowledge(link = 'https://hexnemesis.com') {
  let knowledge = loadSiteKnowledge();
  if (!knowledge) {
    logger.info('[Promoter] Site knowledge missing. Triggering site inspection for ' + link);
    try {
      knowledge = await inspectSite(link);
    } catch {
      knowledge = null;
    }
  }
  return knowledge;
}

/**
 * Generate a post copy promoting hexnemesis.com incorporating real tools and features.
 *
 * @param {Object} opts
 * @param {string} [opts.link="https://hexnemesis.com"] - Target URL
 * @param {string} [opts.topic="technology & innovation"] - Post theme
 * @param {string} [opts.tone="engaging, authentic, professional"] - Tone of voice
 * @returns {Promise<string>} Generated post text
 */
async function generatePostContent(opts = {}) {
  const link = opts.link || 'https://hexnemesis.com';
  const topic = opts.topic || 'technology and innovation';
  const tone = opts.tone || 'engaging, authentic, professional';

  logger.info(`Generating promotional post for link: ${link}, topic: ${topic}`);

  const knowledge = await getSiteKnowledge(link);
  const siteContext = knowledge
    ? `Site Title: ${knowledge.title}\nDescription: ${knowledge.metaDesc}\nKey Headings: ${knowledge.headings.join(', ')}\nSample Tools/Features: ${knowledge.toolsAndLinks.map((t) => t.text).join(', ')}`
    : 'HexNemesis provides advanced technology and AI tools.';

  const openai = getClient();
  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [
      {
        role: 'system',
        content: `You are an expert social media copywriter. Write organic, high-value Facebook posts promoting ${link}.\n\nSite Context from ${link}:\n${siteContext}`,
      },
      {
        role: 'user',
        content: `Create a single Facebook post (2-4 sentences max) discussing ${topic}. Naturally highlight specific features or tools available at ${link}. Tone: ${tone}. Do not use excessive hashtags or pushy sales copy.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  const content = completion.choices[0]?.message?.content?.trim() || '';
  logger.debug(`Generated post content: "${content.slice(0, 80)}..."`);
  return content;
}

/**
 * Generate an authentic, contextual peer-to-peer craftsman comment on a builder's post.
 * STRICT OPERATIONAL SECURITY RULE: Never drop links or domain names in 3rd-party comments.
 * The profile name and avatar serve as the brand touchpoint; comments build rapport and authority.
 *
 * @param {string} postText - Text of the post being commented on
 * @returns {Promise<string>} Clean organic comment text
 */
async function generateComment(postText) {
  logger.info(`Generating organic craftsman comment for post: "${postText.slice(0, 60)}..."`);

  const openai = getClient();
  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [
      {
        role: 'system',
        content: `You are an experienced, respected Master Builder and Finish Carpenter commenting on fellow contractors' Facebook posts.
CRITICAL RULES:
1. DO NOT include any links, URLs, websites, or domain names (e.g., do NOT mention hexnemesis or any .com).
2. DO NOT sound like an ad, bot, or corporate representative.
3. Speak peer-to-peer: genuine, professional, knowledgeable trade feedback. Compliment clean framing lines, tight miter joints, plumb cuts, or ask an intelligent question about the build/lumber.
4. Keep it concise (1-2 punchy sentences maximum).`,
      },
      {
        role: 'user',
        content: `Contractor's Post: "${postText.slice(0, 400)}"\n\nLeave a genuine craftsman comment respecting their work. Zero sales talk, zero links.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 150,
  });

  const comment = completion.choices[0]?.message?.content?.trim() || 'Clean craftsmanship and solid layout work here. Respect.';
  return comment;
}

module.exports = { generatePostContent, generateComment, getSiteKnowledge };
