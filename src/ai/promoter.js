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

/**
 * Generate a post copy promoting hexnemesis.com.
 *
 * @param {Object} opts
 * @param {string} [opts.link="https://hexnemesis.com"] - Target URL
 * @param {string} [opts.topic="technology & innovation"] - Post theme
 * @param {string} [opts.tone="engaging, informative, professional"] - Tone of voice
 * @returns {Promise<string>} Generated post text
 */
async function generatePostContent(opts = {}) {
  const link = opts.link || 'https://hexnemesis.com';
  const topic = opts.topic || 'technology and innovation';
  const tone = opts.tone || 'engaging, authentic, professional';

  logger.info(`Generating promotional post for link: ${link}, topic: ${topic}`);

  const openai = getClient();
  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [
      {
        role: 'system',
        content: 'You are an expert social media copywriter. Write organic, non-spammy Facebook posts that provide value first and naturally highlight a website URL.',
      },
      {
        role: 'user',
        content: `Create a single Facebook post (2-4 sentences max) discussing ${topic}. Naturally introduce ${link} as a helpful resource. Tone: ${tone}. Do not use excessive hashtags or overly pushy sales language.`,
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
 * Generate a contextual comment in response to a post.
 *
 * @param {string} postText - Text of the post being commented on
 * @param {string} [link="https://hexnemesis.com"] - Target URL
 * @returns {Promise<string>} Generated comment text
 */
async function generateComment(postText, link = 'https://hexnemesis.com') {
  logger.info(`Generating comment for post snippet: "${postText.slice(0, 60)}..."`);

  const openai = getClient();
  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [
      {
        role: 'system',
        content: 'You are a knowledgeable social media user leaving helpful, relevant comments on Facebook posts.',
      },
      {
        role: 'user',
        content: `Read this post text: "${postText.slice(0, 400)}"\n\nWrite a 1-2 sentence insightful response that relevantly references ${link} as a useful tool or resource. Make it sound completely natural and conversational.`,
      },
    ],
    temperature: 0.6,
    max_tokens: 200,
  });

  const comment = completion.choices[0]?.message?.content?.trim() || '';
  return comment;
}

module.exports = { generatePostContent, generateComment };
