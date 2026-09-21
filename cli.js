#!/usr/bin/env node
'use strict';

require('dotenv').config();

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');

const { scrapeProfile } = require('./src/scrapers/profile');
const { searchPeople } = require('./src/scrapers/search');
const { getFollowers } = require('./src/scrapers/followers');
const { analyzeProfile, listModes } = require('./src/ai/analyzer');
const { followUser, unfollowUser } = require('./src/actions/follow');
const { addFriend, cancelFriendRequest, bulkAddFriends } = require('./src/actions/addFriend');
const { createPost } = require('./src/actions/post');
const { engageWithContent } = require('./src/actions/engage');
const {
  addTask,
  addBulkTasks,
  getQueueStats,
  listQueue,
  clearQueue,
} = require('./src/engine/queueManager');
const {
  init: initDb,
  saveProfile,
  saveSearchResults,
  getProfiles,
  getProfileById,
  saveAnalysis,
} = require('./src/utils/storage');
const { addJob, removeJob, loadJobs } = require('./src/scheduler/cron');
const { validate } = require('./src/config');

// ─── Banner ───────────────────────────────────────────────────────────────────
function printBanner() {
  console.log(chalk.cyan.bold('\n ███████╗██████╗      ██████╗  ██████╗ ████████╗'));
  console.log(chalk.cyan.bold(' ██╔════╝██╔══██╗     ██╔══██╗██╔═══██╗╚══██╔══╝'));
  console.log(chalk.cyan.bold(' █████╗  ██████╔╝     ██████╔╝██║   ██║   ██║   '));
  console.log(chalk.cyan.bold(' ██╔══╝  ██╔══██╗     ██╔══██╗██║   ██║   ██║   '));
  console.log(chalk.cyan.bold(' ██║     ██████╔╝     ██████╔╝╚██████╔╝   ██║   '));
  console.log(chalk.cyan.bold(' ╚═╝     ╚═════╝      ╚═════╝  ╚═════╝    ╚═╝   '));
  console.log(chalk.gray('  Facebook Scraper Bot — Educational/Research Use Only\n'));
  console.log(chalk.yellow.bold('  ⚠  WARNING: This tool may violate Meta\'s ToS.'));
  console.log(chalk.yellow('     Use responsibly and in compliance with applicable laws.\n'));
}

// ─── Init ─────────────────────────────────────────────────────────────────────
initDb();
const warnings = validate();
for (const w of warnings) {
  console.log(chalk.yellow('  ⚠ ' + w));
}

const program = new Command();
program
  .name('facebook-bot')
  .description('Facebook profile scraper bot with AI analysis')
  .version('1.0.0')
  .hook('preAction', printBanner);

// ─── Command: scrape:profile ──────────────────────────────────────────────────
program
  .command('scrape:profile')
  .description('Scrape a Facebook profile by URL or username')
  .argument('<target>', 'Full URL or username (e.g. "zuck")')
  .option('--no-save', 'Do not save to database')
  .option('--json', 'Output raw JSON')
  .action(async (target, opts) => {
    const spinner = ora(`Scraping profile: ${target}`).start();
    try {
      const profile = await scrapeProfile(target);

      if (!opts.noSave) {
        const id = saveProfile(profile);
        spinner.succeed(chalk.green(`Profile scraped and saved (ID: ${id})`));
      } else {
        spinner.succeed(chalk.green('Profile scraped (not saved)'));
      }

      if (opts.json) {
        console.log(JSON.stringify(profile, null, 2));
      } else {
        printProfile(profile);
      }
    } catch (err) {
      spinner.fail(chalk.red(`Scrape failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Command: scrape:search ───────────────────────────────────────────────────
program
  .command('scrape:search')
  .description('Search Facebook People Search')
  .argument('<query>', 'Name or search query')
  .option('-l, --location <location>', 'Add location to query')
  .option('-p, --pages <n>', 'Max pages to scrape', '2')
  .option('--json', 'Output raw JSON')
  .action(async (query, opts) => {
    const fullQuery = opts.location ? `${query} ${opts.location}` : query;
    const spinner = ora(`Searching: "${fullQuery}"`).start();

    try {
      const results = await searchPeople(fullQuery, { maxPages: parseInt(opts.pages) });
      const searchId = saveSearchResults(fullQuery, results);

      spinner.succeed(chalk.green(`Found ${results.length} profiles (search ID: ${searchId})`));

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        printSearchResults(results);
      }
    } catch (err) {
      spinner.fail(chalk.red(`Search failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Command: analyze ─────────────────────────────────────────────────────────
program
  .command('analyze')
  .description('Analyze a scraped profile with GPT-4o')
  .argument('<profileId>', 'Profile ID from the database')
  .option('-m, --mode <mode>', 'Analysis mode', 'summarize')
  .option('--prompt <text>', 'Custom prompt (requires --mode custom)')
  .option('--json', 'Output raw JSON')
  .action(async (profileId, opts) => {
    const profile = getProfileById(parseInt(profileId));
    if (!profile) {
      console.error(chalk.red(`Profile #${profileId} not found in database.`));
      process.exit(1);
    }

    const spinner = ora(`Analyzing profile #${profileId} with mode="${opts.mode}"...`).start();

    try {
      const { result, usage, model } = await analyzeProfile(profile, opts.mode, opts.prompt);
      const analysisId = saveAnalysis(profileId, opts.mode, result, opts.prompt, model);

      spinner.succeed(chalk.green(`Analysis complete (ID: ${analysisId}, ${usage?.total_tokens || '?'} tokens)`));

      if (opts.json) {
        console.log(JSON.stringify({ result, usage, model }, null, 2));
      } else {
        console.log('\n' + chalk.cyan.bold('─'.repeat(60)));
        console.log(chalk.bold(`Analysis [${opts.mode}] for: ${profile.name || profile.url}`));
        console.log(chalk.cyan('─'.repeat(60)));
        console.log(result);
        console.log(chalk.cyan('─'.repeat(60)) + '\n');
      }
    } catch (err) {
      spinner.fail(chalk.red(`Analysis failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Command: analyze:modes ───────────────────────────────────────────────────
program
  .command('analyze:modes')
  .description('List available AI analysis modes')
  .action(() => {
    console.log(chalk.bold('\nAvailable analysis modes:'));
    for (const m of listModes()) {
      console.log(`  ${chalk.cyan('•')} ${m}`);
    }
    console.log();
  });

// ─── Command: results ─────────────────────────────────────────────────────────
program
  .command('results')
  .description('List scraped profiles from the database')
  .option('--name <name>', 'Filter by name')
  .option('--limit <n>', 'Max results', '20')
  .option('--json', 'Output raw JSON')
  .action((opts) => {
    const profiles = getProfiles({ name: opts.name, limit: parseInt(opts.limit) });
    if (opts.json) {
      console.log(JSON.stringify(profiles, null, 2));
      return;
    }
    console.log(chalk.bold(`\nStored Profiles (${profiles.length}):`));
    const table = new Table({
      head: [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Username'), chalk.cyan('Location'), chalk.cyan('Posts'), chalk.cyan('Scraped At')],
      colWidths: [5, 22, 18, 18, 7, 22],
    });
    for (const p of profiles) {
      table.push([p.id, p.name || '-', p.username || '-', p.location || '-', (p.posts || []).length, p.scraped_at]);
    }
    console.log(table.toString());
  });

// ─── Command: schedule:add ────────────────────────────────────────────────────
program
  .command('schedule:add')
  .description('Add a scheduled scrape job')
  .requiredOption('--id <id>', 'Unique job ID')
  .requiredOption('--name <name>', 'Job display name')
  .requiredOption('--urls <urls>', 'Comma-separated profile URLs')
  .requiredOption('--cron <expr>', 'Cron expression (e.g. "0 9 * * *")')
  .action((opts) => {
    try {
      const urls = opts.urls.split(',').map((u) => u.trim());
      addJob({ id: opts.id, name: opts.name, profileUrls: urls, schedule: opts.cron });
      console.log(chalk.green(`✓ Job "${opts.name}" scheduled: ${opts.cron}`));
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Command: schedule:list ───────────────────────────────────────────────────
program
  .command('schedule:list')
  .description('List all scheduled jobs')
  .action(() => {
    const jobs = loadJobs();
    if (jobs.length === 0) {
      console.log(chalk.yellow('No scheduled jobs found.'));
      return;
    }
    const table = new Table({
      head: [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Schedule'), chalk.cyan('Enabled'), chalk.cyan('URLs')],
    });
    for (const j of jobs) {
      table.push([j.id, j.name, j.schedule, j.enabled ? '✓' : '✗', j.profileUrls.join(', ')]);
    }
    console.log(table.toString());
  });

// ─── Command: schedule:remove ────────────────────────────────────────────────
program
  .command('schedule:remove')
  .description('Remove a scheduled job')
  .argument('<id>', 'Job ID to remove')
  .action((id) => {
    removeJob(id);
    console.log(chalk.green(`✓ Job "${id}" removed.`));
  });

// ─── Command: scrape:followers ────────────────────────────────────────────────
program
  .command('scrape:followers')
  .description('Scrape the followers list of a Facebook profile')
  .argument('<target>', 'Full URL or username')
  .option('-p, --pages <n>', 'Max pages to scrape', '3')
  .option('--json', 'Output raw JSON')
  .action(async (target, opts) => {
    const spinner = ora(`Scraping followers of: ${target}`).start();
    try {
      const followers = await getFollowers(target, { maxPages: parseInt(opts.pages) });
      saveSearchResults(`followers:${target}`, followers);
      spinner.succeed(chalk.green(`Found ${followers.length} followers`));
      if (opts.json) {
        console.log(JSON.stringify(followers, null, 2));
      } else {
        printSearchResults(followers);
      }
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Command: action:follow ───────────────────────────────────────────────────
program
  .command('action:follow')
  .description('Follow a Facebook profile')
  .argument('<target>', 'Profile URL or username')
  .action(async (target) => {
    const spinner = ora(`Following: ${target}`).start();
    try {
      const result = await followUser(target);
      if (result.success) {
        spinner.succeed(chalk.green(`✓ ${result.message}`));
      } else {
        spinner.warn(chalk.yellow(`⚠ ${result.action}: ${result.message}`));
      }
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Command: action:unfollow ─────────────────────────────────────────────────
program
  .command('action:unfollow')
  .description('Unfollow a Facebook profile')
  .argument('<target>', 'Profile URL or username')
  .action(async (target) => {
    const spinner = ora(`Unfollowing: ${target}`).start();
    try {
      const result = await unfollowUser(target);
      if (result.success) {
        spinner.succeed(chalk.green(`✓ ${result.message}`));
      } else {
        spinner.warn(chalk.yellow(`⚠ ${result.action}: ${result.message}`));
      }
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Command: action:add-friend ───────────────────────────────────────────────
program
  .command('action:add-friend')
  .description('Send a friend request to a Facebook profile')
  .argument('<target>', 'Profile URL or username')
  .action(async (target) => {
    const spinner = ora(`Sending friend request to: ${target}`).start();
    try {
      const result = await addFriend(target);
      if (result.success) {
        spinner.succeed(chalk.green(`✓ ${result.message}`));
      } else {
        spinner.warn(chalk.yellow(`⚠ ${result.action}: ${result.message}`));
      }
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Command: action:cancel-request ──────────────────────────────────────────
program
  .command('action:cancel-request')
  .description('Cancel a pending friend request')
  .argument('<target>', 'Profile URL or username')
  .action(async (target) => {
    const spinner = ora(`Cancelling friend request to: ${target}`).start();
    try {
      const result = await cancelFriendRequest(target);
      if (result.success) {
        spinner.succeed(chalk.green(`✓ ${result.message}`));
      } else {
        spinner.warn(chalk.yellow(`⚠ ${result.action}: ${result.message}`));
      }
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Command: action:bulk-add ─────────────────────────────────────────────────
program
  .command('action:bulk-add')
  .description('Send friend requests to multiple profiles (rate-limited)')
  .argument('<urls>', 'Comma-separated profile URLs')
  .option('--delay-min <ms>', 'Min delay between requests (ms)', '8000')
  .option('--delay-max <ms>', 'Max delay between requests (ms)', '20000')
  .option('--max <n>', 'Max requests per session (safety cap)', '10')
  .option('--json', 'Output raw JSON results')
  .action(async (urlsArg, opts) => {
    const urls = urlsArg.split(',').map((u) => u.trim()).filter(Boolean);
    console.log(chalk.yellow(`\n⚠  Bulk-adding ${urls.length} profiles (max ${opts.max}/session). Use responsibly.\n`));

    const spinner = ora(`Processing ${urls.length} friend requests...`).start();
    try {
      const results = await bulkAddFriends(urls, {
        delayBetween: [parseInt(opts.delayMin), parseInt(opts.delayMax)],
        maxPerSession: parseInt(opts.max),
      });
      const sent = results.filter((r) => r.action === 'request_sent').length;
      spinner.succeed(chalk.green(`Done: ${sent}/${results.length} requests sent`));

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        const table = new Table({
          head: [chalk.cyan('#'), chalk.cyan('URL'), chalk.cyan('Action'), chalk.cyan('Message')],
          colWidths: [4, 45, 20, 30],
        });
        results.forEach((r, i) => {
          const actionColor = r.success ? chalk.green(r.action) : chalk.red(r.action);
          table.push([i + 1, r.url, actionColor, r.message || '-']);
        });
        console.log(table.toString());
      }
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Command: action:post ─────────────────────────────────────────────────────
program
  .command('action:post')
  .description('Create a post promoting hexnemesis.com or custom content')
  .option('-t, --target <url>', 'Target page, group, or feed URL', 'https://www.facebook.com/')
  .option('--text <text>', 'Explicit post text (if omitted, AI generates promotion for hexnemesis.com)')
  .option('--link <url>', 'Promo link to highlight', 'https://hexnemesis.com')
  .action(async (opts) => {
    const spinner = ora('Creating post...').start();
    try {
      const result = await createPost({ targetUrl: opts.target, text: opts.text, promoLink: opts.link });
      if (result.success) {
        spinner.succeed(chalk.green(`✓ Post created: "${result.text.slice(0, 60)}..."`));
      } else {
        spinner.warn(chalk.yellow(`⚠ ${result.action}: ${result.message}`));
      }
    } catch (err) {
      spinner.fail(chalk.red(`Failed to post: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Command: action:engage ───────────────────────────────────────────────────
program
  .command('action:engage')
  .description('Like and leave an AI comment promoting hexnemesis.com on a target post')
  .argument('<target>', 'Target post or profile URL')
  .option('--no-like', 'Skip liking')
  .option('--no-comment', 'Skip commenting')
  .option('--link <url>', 'Promo link for comment', 'https://hexnemesis.com')
  .action(async (target, opts) => {
    const spinner = ora(`Engaging with content on ${target}...`).start();
    try {
      const result = await engageWithContent(target, { like: opts.like, comment: opts.comment, promoLink: opts.link });
      if (result.success) {
        spinner.succeed(chalk.green(`✓ Engaged: ${result.message}`));
      } else {
        spinner.warn(chalk.yellow(`⚠ ${result.action}: ${result.message}`));
      }
    } catch (err) {
      spinner.fail(chalk.red(`Failed to engage: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Command: queue:add ───────────────────────────────────────────────────────
program
  .command('queue:add')
  .description('Enqueue an autonomous task (follow, add_friend, scrape_profile, etc.)')
  .requiredOption('-a, --action <action>', 'Action type (follow | add_friend | scrape_profile | scrape_followers | unfollow | cancel_request)')
  .requiredOption('-t, --target <target>', 'Target profile URL or username')
  .option('-p, --priority <n>', 'Priority level (higher numbers run first)', '1')
  .action((opts) => {
    try {
      const task = addTask({
        action: opts.action,
        target: opts.target,
        priority: parseInt(opts.priority),
      });
      console.log(chalk.green(`✓ Enqueued task #${task.id}: ${task.action} -> ${task.target}`));
    } catch (err) {
      console.error(chalk.red(`Failed to queue task: ${err.message}`));
    }
  });

// ─── Command: queue:bulk ──────────────────────────────────────────────────────
program
  .command('queue:bulk')
  .description('Bulk enqueue targets for an action')
  .requiredOption('-a, --action <action>', 'Action type (follow | add_friend | scrape_profile)')
  .requiredOption('-t, --targets <urls>', 'Comma-separated target URLs/usernames')
  .option('-p, --priority <n>', 'Priority level', '1')
  .action((opts) => {
    const targets = opts.targets.split(',').map(t => t.trim()).filter(Boolean);
    const tasks = addBulkTasks(opts.action, targets, {}, parseInt(opts.priority));
    console.log(chalk.green(`✓ Enqueued ${tasks.length} tasks for action "${opts.action}"`));
  });

// ─── Command: queue:status ────────────────────────────────────────────────────
program
  .command('queue:status')
  .description('Display autonomous queue status and task counts')
  .action(() => {
    const stats = getQueueStats();
    console.log(chalk.bold('\nAutonomous Task Queue Overview:'));
    const table = new Table({
      head: [chalk.cyan('Total'), chalk.cyan('Pending'), chalk.cyan('Processing'), chalk.cyan('Completed'), chalk.cyan('Failed')],
    });
    table.push([stats.total, chalk.yellow(stats.pending), chalk.blue(stats.processing), chalk.green(stats.completed), chalk.red(stats.failed)]);
    console.log(table.toString() + '\n');
  });

// ─── Command: queue:list ──────────────────────────────────────────────────────
program
  .command('queue:list')
  .description('List tasks in the autonomous queue')
  .option('-s, --status <status>', 'Filter by status (pending | processing | completed | failed)')
  .option('-l, --limit <n>', 'Max items', '20')
  .option('--json', 'Output JSON')
  .action((opts) => {
    const items = listQueue({ status: opts.status, limit: parseInt(opts.limit) });
    if (opts.json) {
      console.log(JSON.stringify(items, null, 2));
      return;
    }

    console.log(chalk.bold(`\nQueued Tasks (${items.length}):`));
    const table = new Table({
      head: [chalk.cyan('ID'), chalk.cyan('Action'), chalk.cyan('Target'), chalk.cyan('Priority'), chalk.cyan('Status'), chalk.cyan('Created')],
      colWidths: [6, 18, 40, 10, 14, 22],
    });

    for (const item of items) {
      const statusColor = item.status === 'completed' ? chalk.green(item.status) :
                          item.status === 'failed' ? chalk.red(item.status) :
                          item.status === 'processing' ? chalk.blue(item.status) : chalk.yellow(item.status);
      table.push([item.id, item.action, item.target, item.priority, statusColor, item.created_at.slice(0, 19).replace('T', ' ')]);
    }
    console.log(table.toString() + '\n');
  });

// ─── Command: queue:clear ─────────────────────────────────────────────────────
program
  .command('queue:clear')
  .description('Clear tasks from the queue')
  .option('-s, --status <status>', 'Clear only tasks matching status (e.g. completed | failed)')
  .action((opts) => {
    clearQueue(opts.status);
    console.log(chalk.green(`✓ Queue cleared${opts.status ? ` for status "${opts.status}"` : ''}.`));
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function printProfile(p) {
  console.log('\n' + chalk.cyan.bold('─'.repeat(60)));
  console.log(chalk.bold('  Profile: ') + (p.name || 'Unknown'));
  console.log(chalk.bold('  URL:     ') + p.url);
  if (p.bio)       console.log(chalk.bold('  Bio:     ') + p.bio);
  if (p.location)  console.log(chalk.bold('  Location:') + p.location);
  if (p.avatarUrl) console.log(chalk.bold('  Avatar:  ') + p.avatarUrl);
  if (p.posts?.length) {
    console.log(chalk.bold(`\n  Posts (${p.posts.length}):`));
    p.posts.slice(0, 3).forEach((post, i) => {
      console.log(chalk.gray(`  [${i + 1}] `) + post.text.slice(0, 120) + (post.text.length > 120 ? '...' : ''));
    });
  }
  console.log(chalk.cyan('─'.repeat(60)) + '\n');
}

function printSearchResults(results) {
  if (!results.length) {
    console.log(chalk.yellow('No results found.'));
    return;
  }
  const table = new Table({
    head: [chalk.cyan('#'), chalk.cyan('Name'), chalk.cyan('Location'), chalk.cyan('URL')],
    colWidths: [4, 26, 22, 50],
  });
  results.forEach((r, i) => {
    table.push([i + 1, r.name || '-', r.location || '-', r.url || '-']);
  });
  console.log(table.toString());
}

program.parse(process.argv);
