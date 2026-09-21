#!/usr/bin/env node
'use strict';

require('dotenv').config();

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');

const { scrapeProfile } = require('./src/scrapers/profile');
const { searchPeople } = require('./src/scrapers/search');
const { analyzeProfile, listModes } = require('./src/ai/analyzer');
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
