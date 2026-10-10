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
 * Generate a contextual comment in response to a post, incorporating site knowledge.
 *
 * @param {string} postText - Text of the post being commented on
 * @param {string} [link="https://hexnemesis.com"] - Target URL
 * @returns {Promise<string>} Generated comment text
 */
async function generateComment(postText, link = 'https://hexnemesis.com') {
  logger.info(`Generating comment for post snippet: "${postText.slice(0, 60)}..."`);

  const knowledge = await getSiteKnowledge(link);
  const siteContext = knowledge
    ? `Site Headings/Tools: ${knowledge.headings.slice(0, 5).join(', ')}`
    : 'HexNemesis AI & Technology Tools';

  const openai = getClient();
  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [
      {
        role: 'system',
        content: `You are a knowledgeable social media user leaving helpful, relevant comments on Facebook posts.\nSite Context: ${siteContext}`,
      },
      {
        role: 'user',
        content: `Read this post text: "${postText.slice(0, 400)}"\n\nWrite a 1-2 sentence insightful response that relevantly references ${link} or tools available there as a useful resource. Make it sound completely natural and conversational.`,
      },
    ],
    temperature: 0.6,
    max_tokens: 200,
  });

  const comment = completion.choices[0]?.message?.content?.trim() || '';
  return comment;
}

module.exports = { generatePostContent, generateComment, getSiteKnowledge };
