'use strict';

require('dotenv').config();

const { getNextTask, updateTaskStatus, getQueueStats } = require('./queueManager');
const { followUser, unfollowUser } = require('../actions/follow');
const { addFriend, cancelFriendRequest } = require('../actions/addFriend');
const { scrapeProfile } = require('../scrapers/profile');
const { getFollowers } = require('../scrapers/followers');
const { saveProfile, saveSearchResults } = require('../utils/storage');
const { canPerformAction, maybeTakeBreak } = require('../utils/sessionBehavior');
const { gaussianDelay, randInt } = require('../utils/humanBehavior');
const logger = require('../utils/logger');

let isRunning = false;
let processedCount = 0;

/**
 * Check if the worker should sleep based on simulated "sleeping hours" (e.g. 11 PM to 7 AM).
 */
function isSleepingHours() {
  const hour = new Date().getHours();
  // Sleeping between 23:00 (11 PM) and 07:00 AM
  return hour >= 23 || hour < 7;
}

/**
 * Dispatch task to the corresponding module.
 */
async function executeTask(task) {
  const { action, target, payload } = task;

  switch (action) {
    case 'follow':
      return await followUser(target);

    case 'unfollow':
      return await unfollowUser(target);

    case 'add_friend':
      return await addFriend(target);

    case 'cancel_request':
      return await cancelFriendRequest(target);

    case 'scrape_profile': {
      const profile = await scrapeProfile(target);
      const profileId = saveProfile(profile);
      return { success: true, profileId, profile };
    }

    case 'scrape_followers': {
      const followers = await getFollowers(target, payload);
      const searchId = saveSearchResults(`followers:${target}`, followers);
      return { success: true, searchId, count: followers.length, followers };
    }

    default:
      throw new Error(`Unsupported task action: ${action}`);
  }
}

/**
 * Main autonomous loop iteration.
 */
async function workerLoop() {
  if (!isRunning) return;

  try {
    // 1. Check if bot should be sleeping
    if (isSleepingHours()) {
      logger.info('[AutonomousWorker] Currently in sleeping hours (11 PM - 7 AM). Worker resting for 30 minutes...');
      await new Promise(r => setTimeout(r, 30 * 60 * 1000));
      return setImmediate(workerLoop);
    }

    // 2. Fetch next task
    const task = getNextTask();

    if (!task) {
      // Idle pause if queue is empty
      const idleMs = randInt(15000, 30000); // 15-30s poll interval when queue is empty
      logger.debug(`[AutonomousWorker] Queue empty. Idle check in ${Math.round(idleMs / 1000)}s...`);
      await new Promise(r => setTimeout(r, idleMs));
      return setImmediate(workerLoop);
    }

    // 3. Map action string for session limit check
    const actionLimitMap = {
      'follow': 'follow',
      'unfollow': 'unfollow',
      'add_friend': 'addFriend',
      'cancel_request': 'cancelRequest',
      'scrape_profile': 'scrape',
      'scrape_followers': 'scrape',
    };

    const limitKey = actionLimitMap[task.action];
    if (limitKey && !canPerformAction(limitKey)) {
      logger.warn(`[AutonomousWorker] Daily limit reached for ${task.action}. Re-queueing task #${task.id} for later.`);
      // Defer task
      updateTaskStatus(task.id, 'pending', { priority: -1 });
      await new Promise(r => setTimeout(r, 60000));
      return setImmediate(workerLoop);
    }

    // 4. Mark task as processing
    updateTaskStatus(task.id, 'processing', { attempts: (task.attempts || 0) + 1 });
    logger.info(`[AutonomousWorker] Executing task #${task.id} (${task.action} -> ${task.target})`);

    // 5. Execute task
    const result = await executeTask(task);

    if (result && result.success !== false) {
      updateTaskStatus(task.id, 'completed', { result });
      logger.info(`[AutonomousWorker] ✓ Completed task #${task.id}`);
      processedCount++;
    } else {
      updateTaskStatus(task.id, 'failed', { error: result?.message || 'Action returned failure status' });
      logger.warn(`[AutonomousWorker] ✗ Failed task #${task.id}: ${result?.message}`);
    }

    // 6. Handle realistic pauses & session breaks
    await maybeTakeBreak(processedCount);

    // Randomized delay between tasks (15s to 45s)
    const delayMs = randInt(15000, 45000);
    logger.info(`[AutonomousWorker] Resting for ${Math.round(delayMs / 1000)}s before next task...`);
    await new Promise(r => setTimeout(r, delayMs));

  } catch (err) {
    logger.error(`[AutonomousWorker] Unexpected worker error: ${err.message}`);
    if (task?.id) {
      updateTaskStatus(task.id, 'failed', { error: err.message });
    }
    // Pause briefly on exception
    await new Promise(r => setTimeout(r, 15000));
  }

  // Continue loop
  if (isRunning) setImmediate(workerLoop);
}

/**
 * Start worker.
 */
function startWorker() {
  if (isRunning) {
    logger.info('[AutonomousWorker] Worker is already running.');
    return;
  }
  isRunning = true;
  logger.info('[AutonomousWorker] Starting background engine...');
  workerLoop();
}

/**
 * Stop worker gracefully.
 */
function stopWorker() {
  logger.info('[AutonomousWorker] Stopping background engine...');
  isRunning = false;
}

// Allow direct execution via CLI script
if (require.main === module) {
  const { init: initDb } = require('../utils/storage');
  initDb();
  startWorker();
}

module.exports = { startWorker, stopWorker, isRunning: () => isRunning };
