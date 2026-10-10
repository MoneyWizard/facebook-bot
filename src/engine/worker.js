'use strict';

require('dotenv').config();

const { getNextTask, updateTaskStatus, getQueueStats } = require('./queueManager');
const { followUser, unfollowUser } = require('../actions/follow');
const { addFriend, cancelFriendRequest } = require('../actions/addFriend');
const { createPost } = require('../actions/post');
const { engageWithContent } = require('../actions/engage');
const { sendDM, checkAndReplyInbox } = require('../actions/messenger');
const { joinGroup, engageGroup } = require('../actions/groups');
const { createPage, createGroup, inviteFriendsToGroup, inviteFriendsToPage } = require('../actions/community');
const { sendNotification } = require('../utils/notifications');
const { scrapeProfile } = require('../scrapers/profile');
const { getFollowers } = require('../scrapers/followers');
const { saveProfile, saveSearchResults } = require('../utils/storage');
const { canPerformAction, maybeTakeBreak } = require('../utils/sessionBehavior');
const { gaussianDelay, randInt } = require('../utils/humanBehavior');
const { runAutoPilotCycle } = require('./autoPilot');
const { config } = require('../config');
const logger = require('../utils/logger');

let isRunning = false;
let processedCount = 0;

/**
 * Check if the worker should sleep based on simulated "sleeping hours" (e.g. 11 PM to 7 AM).
 */
function isSleepingHours() {
  if (config.autoPilot?.nightOperations) {
    return false; // 24/7 continuous operation active
  }
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

    case 'post':
      return await createPost({ targetUrl: target, ...payload });

    case 'engage':
      return await engageWithContent(target, payload);

    case 'dm':
      return await sendDM(target, payload?.text || 'Hello!');

    case 'check_inbox':
      return await checkAndReplyInbox();

    case 'join_group':
      return await joinGroup(target);

    case 'engage_group':
      return await engageGroup(target);

    case 'create_page':
      return await createPage(payload);

    case 'create_group':
      return await createGroup(payload);

    case 'invite_group':
      return await inviteFriendsToGroup(target, payload?.maxInvites || 20);

    case 'invite_page':
      return await inviteFriendsToPage(target || 'https://www.facebook.com/profile.php?id=61588703994992', payload?.maxInvites || 30);

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

  let currentTask = null;

  try {
    // 1. Check if bot should be sleeping
    if (isSleepingHours()) {
      logger.info('[AutonomousWorker] Currently in sleeping hours (11 PM - 7 AM). Worker resting for 30 minutes...');
      await new Promise(r => setTimeout(r, 30 * 60 * 1000));
      return setImmediate(workerLoop);
    }

    // 2. Fetch next task
    currentTask = getNextTask();

    // 3. If queue is empty, trigger Auto-Pilot Discovery to auto-populate the queue!
    if (!currentTask && config.autoPilot?.enabled !== false) {
      logger.info('[AutonomousWorker] Queue empty. Triggering Auto-Pilot Discovery Engine...');
      await runAutoPilotCycle();
      currentTask = getNextTask(); // Fetch newly discovered task
    }

    if (!currentTask) {
      // Idle pause if still empty after Auto-Pilot
      const idleMs = randInt(15000, 30000); // 15-30s poll interval
      logger.debug(`[AutonomousWorker] Queue idle. Check in ${Math.round(idleMs / 1000)}s...`);
      await new Promise(r => setTimeout(r, idleMs));
      return setImmediate(workerLoop);
    }

    // 3. Map action string for session limit check
    const actionLimitMap = {
      'follow': 'follow',
      'unfollow': 'unfollow',
      'add_friend': 'addFriend',
      'cancel_request': 'cancelRequest',
      'post': 'post',
      'engage': 'comment',
      'scrape_profile': 'scrape',
      'scrape_followers': 'scrape',
    };

    const limitKey = actionLimitMap[currentTask.action];
    if (limitKey && !canPerformAction(limitKey)) {
      logger.warn(`[AutonomousWorker] Daily limit reached for ${currentTask.action}. Re-queueing task #${currentTask.id} for later.`);
      // Defer task
      updateTaskStatus(currentTask.id, 'pending', { priority: -1 });
      await new Promise(r => setTimeout(r, 60000));
      return setImmediate(workerLoop);
    }

    // 4. Mark task as processing
    updateTaskStatus(currentTask.id, 'processing', { attempts: (currentTask.attempts || 0) + 1 });
    logger.info(`[AutonomousWorker] Executing task #${currentTask.id} (${currentTask.action} -> ${currentTask.target})`);

    // 5. Execute task
    const result = await executeTask(currentTask);

    if (result && result.success !== false) {
      updateTaskStatus(currentTask.id, 'completed', { result });
      logger.info(`[AutonomousWorker] ✓ Completed task #${currentTask.id}`);
      processedCount++;
    } else {
      updateTaskStatus(currentTask.id, 'failed', { error: result?.message || 'Action returned failure status' });
      logger.warn(`[AutonomousWorker] ✗ Failed task #${currentTask.id}: ${result?.message}`);
    }

    // 6. Handle realistic pauses & session breaks
    await maybeTakeBreak(processedCount);

    // Randomized delay between tasks (15s to 45s)
    const delayMs = randInt(15000, 45000);
    logger.info(`[AutonomousWorker] Resting for ${Math.round(delayMs / 1000)}s before next task...`);
    await new Promise(r => setTimeout(r, delayMs));

  } catch (err) {
    logger.error(`[AutonomousWorker] Unexpected worker error: ${err.message}`);
    if (currentTask?.id) {
      updateTaskStatus(currentTask.id, 'failed', { error: err.message });
    }
    // Pause briefly on exception before continuing
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
