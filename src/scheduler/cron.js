'use strict';

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { scrapeProfile } = require('../scrapers/profile');
const { saveProfile } = require('../utils/storage');
const logger = require('../utils/logger');
const { randomDelay } = require('../utils/humanBehavior');

const JOBS_FILE = path.resolve('./data/scheduled-jobs.json');

/**
 * Load scheduled jobs from the jobs file.
 * Jobs file format:
 * [
 *   {
 *     "id": "job1",
 *     "name": "Monitor Zuck",
 *     "profileUrls": ["https://www.facebook.com/zuck"],
 *     "schedule": "0 9 * * *",   // cron expression: daily at 9am
 *     "enabled": true
 *   }
 * ]
 */
function loadJobs() {
  if (!fs.existsSync(JOBS_FILE)) {
    logger.info('No scheduled jobs file found at ' + JOBS_FILE);
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
  } catch (err) {
    logger.error('Failed to parse scheduled-jobs.json: ' + err.message);
    return [];
  }
}

/**
 * Save jobs config back to disk.
 */
function saveJobs(jobs) {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

/**
 * Add a new scheduled job.
 */
function addJob({ id, name, profileUrls, schedule, enabled = true }) {
  const jobs = loadJobs();
  if (jobs.find((j) => j.id === id)) {
    throw new Error(`Job with id "${id}" already exists`);
  }
  jobs.push({ id, name, profileUrls, schedule, enabled });
  saveJobs(jobs);
  logger.info(`Scheduled job added: "${name}" (${schedule})`);
  return jobs;
}

/**
 * Remove a scheduled job by id.
 */
function removeJob(id) {
  const jobs = loadJobs().filter((j) => j.id !== id);
  saveJobs(jobs);
  logger.info(`Scheduled job removed: ${id}`);
  return jobs;
}

/**
 * Start all enabled scheduled jobs.
 * Call this on server startup.
 */
function startScheduler() {
  const jobs = loadJobs();
  const enabled = jobs.filter((j) => j.enabled);

  if (enabled.length === 0) {
    logger.info('No enabled scheduled jobs to start.');
    return;
  }

  logger.info(`Starting ${enabled.length} scheduled job(s)...`);

  for (const job of enabled) {
    if (!cron.validate(job.schedule)) {
      logger.warn(`Invalid cron expression for job "${job.name}": ${job.schedule}`);
      continue;
    }

    cron.schedule(job.schedule, async () => {
      logger.info(`[CRON] Running job: "${job.name}"`);
      const results = [];

      for (const url of job.profileUrls) {
        try {
          const profile = await scrapeProfile(url);
          const id = saveProfile(profile);
          results.push({ url, success: true, profileId: id, name: profile.name });
          logger.info(`[CRON] ✓ Scraped: ${profile.name || url} (id=${id})`);
          // Human delay between profiles
          await randomDelay(3000, 8000);
        } catch (err) {
          results.push({ url, success: false, error: err.message });
          logger.error(`[CRON] ✗ Failed: ${url} — ${err.message}`);
        }
      }

      logger.info(`[CRON] Job "${job.name}" complete. Results: ${JSON.stringify(results)}`);
    });

    logger.info(`[CRON] Scheduled: "${job.name}" → ${job.schedule}`);
  }
}

module.exports = { startScheduler, addJob, removeJob, loadJobs, saveJobs };
