'use strict';

const { getDb } = require('../utils/storage');
const logger = require('../utils/logger');

/**
 * Initialize queue collection in lowdb if missing.
 */
function initQueue() {
  const db = getDb();
  if (!db.get('queue').value()) {
    db.set('queue', []).write();
  }
}

/**
 * Add a task to the queue.
 *
 * @param {Object} task
 * @param {string} task.action    - 'follow' | 'unfollow' | 'add_friend' | 'cancel_request' | 'scrape_profile' | 'scrape_followers'
 * @param {string} task.target    - URL or username
 * @param {Object} [task.payload] - Additional options (e.g., maxPages)
 * @param {number} [task.priority]- Higher number = executed first (default 1)
 * @returns {Object} Created task item
 */
function addTask({ action, target, payload = {}, priority = 1 }) {
  initQueue();
  const db = getDb();

  // Check if identical pending task already exists
  const existing = db.get('queue')
    .find({ action, target, status: 'pending' })
    .value();

  if (existing) {
    logger.debug(`Task already queued: ${action} -> ${target}`);
    return existing;
  }

  const items = db.get('queue').value();
  const id = items.length ? Math.max(...items.map(i => i.id || 0)) + 1 : 1;

  const newTask = {
    id,
    action,
    target,
    payload,
    priority,
    status: 'pending', // 'pending' | 'processing' | 'completed' | 'failed'
    attempts: 0,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.get('queue').push(newTask).write();
  logger.info(`[Queue] Added task #${id}: ${action} -> ${target}`);
  return newTask;
}

/**
 * Add multiple targets for a specific action in bulk.
 */
function addBulkTasks(action, targets, payload = {}, priority = 1) {
  const added = [];
  for (const target of targets) {
    if (target && target.trim()) {
      const task = addTask({ action, target: target.trim(), payload, priority });
      added.push(task);
    }
  }
  return added;
}

/**
 * Get next pending task, ordered by priority (descending) and created_at (ascending).
 * Optionally accepts a filterFn to skip tasks that are currently restricted (e.g. daily limits reached).
 */
function getNextTask(filterFn = null) {
  initQueue();
  const db = getDb();

  let pending = db.get('queue')
    .filter({ status: 'pending' })
    .value();

  if (!pending.length) return null;

  if (typeof filterFn === 'function') {
    pending = pending.filter(filterFn);
    if (!pending.length) return null;
  }

  // Sort by priority desc, then created_at asc
  pending.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  return pending[0];
}

/**
 * Update task status.
 */
function updateTaskStatus(id, status, extra = {}) {
  initQueue();
  const db = getDb();

  const task = db.get('queue').find({ id }).value();
  if (!task) return null;

  const updateData = {
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  };

  db.get('queue')
    .find({ id })
    .assign(updateData)
    .write();

  return db.get('queue').find({ id }).value();
}

const { getTodayCounts } = require('../utils/sessionBehavior');

/**
 * Get queue summary stats.
 */
function getQueueStats() {
  initQueue();
  const db = getDb();
  const queue = db.get('queue').value() || [];
  const tc = getTodayCounts() || {};

  return {
    total: queue.length,
    pending: queue.filter(t => t.status === 'pending').length,
    processing: queue.filter(t => t.status === 'processing').length,
    completed: queue.filter(t => t.status === 'completed').length,
    failed: queue.filter(t => t.status === 'failed').length,
    todayCounts: tc,
    postsToday: tc.post || 0,
    engagementsToday: (tc.comment || 0) + (tc.like || 0),
    friendsToday: tc.addFriend || 0,
  };
}

/**
 * List queued tasks with optional filtering.
 */
function listQueue({ status, limit = 50, offset = 0 } = {}) {
  initQueue();
  const db = getDb();
  let chain = db.get('queue');

  if (status) {
    chain = chain.filter({ status });
  }

  const items = chain.value() || [];
  const sorted = [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return sorted.slice(offset, offset + limit);
}

/**
 * Clear queue items.
 */
function clearQueue(statusFilter = null) {
  initQueue();
  const db = getDb();

  if (statusFilter) {
    db.get('queue').remove({ status: statusFilter }).write();
  } else {
    db.set('queue', []).write();
  }
}

module.exports = {
  addTask,
  addBulkTasks,
  getNextTask,
  updateTaskStatus,
  getQueueStats,
  listQueue,
  clearQueue,
};
