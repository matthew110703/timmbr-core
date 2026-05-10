#!/usr/bin/env node
/**
 * Interactive conventional commit helper.
 * Prompts for type, scope, subject, body, and breaking change,
 * then runs: git commit -m "<assembled message>"
 *
 * Draft recovery: if a commit fails (e.g. pre-commit hook rejects it),
 * answers are saved to .git/COMMIT_DRAFT.json. On the next run the dev
 * is asked whether to reuse them or start fresh.
 */

import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

// Stored inside .git/ — local only, never committed, no gitignore needed
const DRAFT_FILE = join('.git', 'COMMIT_DRAFT.json');

const TYPES = [
  { value: 'feat', description: 'A new feature' },
  { value: 'fix', description: 'A bug fix' },
  { value: 'docs', description: 'Documentation changes only' },
  { value: 'style', description: 'Code style changes (formatting, whitespace)' },
  { value: 'refactor', description: 'Code refactoring without feature or fix' },
  { value: 'perf', description: 'Performance improvement' },
  { value: 'test', description: 'Adding or updating tests' },
  { value: 'chore', description: 'Build process, tooling, or dependency updates' },
  { value: 'ci', description: 'CI/CD configuration changes' },
  { value: 'build', description: 'Build system changes' },
  { value: 'revert', description: 'Reverts a previous commit' },
];

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';

// Single readline interface kept open for the full session
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

const print = (msg) => process.stdout.write(msg + '\n');
const hr = () => print(`${DIM}${'─'.repeat(60)}${RESET}`);

// ─── Draft helpers ────────────────────────────────────────────────────────────

function loadDraft() {
  if (!existsSync(DRAFT_FILE)) return null;
  try {
    return JSON.parse(readFileSync(DRAFT_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveDraft(answers) {
  writeFileSync(
    DRAFT_FILE,
    JSON.stringify({ ...answers, savedAt: new Date().toISOString() }, null, 2),
  );
}

function clearDraft() {
  if (existsSync(DRAFT_FILE)) unlinkSync(DRAFT_FILE);
}

// ─── Prompt helpers ───────────────────────────────────────────────────────────

function printTypeMenu() {
  print('');
  print(`${BOLD}Select commit type:${RESET}`);
  print('');
  TYPES.forEach(({ value, description }, i) => {
    const num = String(i + 1).padStart(2);
    print(`  ${CYAN}${num}${RESET}  ${BOLD}${value}${RESET}${DIM} — ${description}${RESET}`);
  });
  print('');
}

async function selectType() {
  printTypeMenu();
  while (true) {
    const input = (await ask(`${YELLOW}?${RESET} ${BOLD}Type${RESET} (1-${TYPES.length}): `)).trim();
    const idx = parseInt(input, 10) - 1;
    if (idx >= 0 && idx < TYPES.length) return TYPES[idx].value;
    const direct = TYPES.find((t) => t.value === input);
    if (direct) return direct.value;
    print(`${RED}  Invalid selection. Enter a number (1-${TYPES.length}) or type name.${RESET}`);
  }
}

async function getScope() {
  const input = (
    await ask(`${YELLOW}?${RESET} ${BOLD}Scope${RESET} ${DIM}(optional, e.g. auth, prisma)${RESET}: `)
  ).trim();
  return input || null;
}

async function getSubject() {
  while (true) {
    const input = (
      await ask(
        `${YELLOW}?${RESET} ${BOLD}Subject${RESET} ${DIM}(short description, lowercase)${RESET}: `,
      )
    ).trim();
    if (!input) {
      print(`${RED}  Subject is required.${RESET}`);
      continue;
    }
    if (input.length > 100) {
      print(`${RED}  Subject must be 100 characters or less (currently ${input.length}).${RESET}`);
      continue;
    }
    if (input.endsWith('.')) {
      print(`${RED}  Subject must not end with a period.${RESET}`);
      continue;
    }
    return input.toLowerCase();
  }
}

async function getBody() {
  const input = (
    await ask(`${YELLOW}?${RESET} ${BOLD}Body${RESET} ${DIM}(optional, longer description)${RESET}: `)
  ).trim();
  return input || null;
}

async function getBreakingChange() {
  const input = (
    await ask(
      `${YELLOW}?${RESET} ${BOLD}Breaking change${RESET} ${DIM}(optional, describe if any)${RESET}: `,
    )
  ).trim();
  return input || null;
}

async function confirm(question) {
  const input = (await ask(`${YELLOW}?${RESET} ${BOLD}${question}${RESET} ${DIM}(y/N)${RESET}: `))
    .trim()
    .toLowerCase();
  return input === 'y' || input === 'yes';
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function buildMessage({ type, scope, subject, body, breaking }) {
  const scopePart = scope ? `(${scope})` : '';
  const breakingMark = breaking ? '!' : '';
  const header = `${type}${scopePart}${breakingMark}: ${subject}`;
  const parts = [header];
  if (body) parts.push('', body);
  if (breaking) parts.push('', `BREAKING CHANGE: ${breaking}`);
  return { header, message: parts.join('\n') };
}

function printPreview({ header, body, breaking }) {
  print('');
  hr();
  print(`${BOLD}Commit message preview:${RESET}`);
  print('');
  print(`  ${GREEN}${header}${RESET}`);
  if (body) print(`${DIM}  ${body}${RESET}`);
  if (breaking) print(`${RED}  BREAKING CHANGE: ${breaking}${RESET}`);
  print('');
  hr();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  print('');
  print(`${BOLD}${BLUE}  Conventional Commit Helper${RESET}`);
  hr();

  // ── Draft recovery ──────────────────────────────────────────────────────────
  let answers = null;
  const draft = loadDraft();

  if (draft) {
    const { type, scope, subject, body, breaking, savedAt } = draft;
    const when = new Date(savedAt).toLocaleString();

    print(`${YELLOW}  Saved draft found${RESET} ${DIM}(from ${when})${RESET}`);
    print('');
    print(
      `  ${BOLD}${type}${scope ? `(${scope})` : ''}${breaking ? '!' : ''}: ${subject}${RESET}`,
    );
    if (body) print(`  ${DIM}${body}${RESET}`);
    if (breaking) print(`  ${RED}BREAKING CHANGE: ${breaking}${RESET}`);
    print('');

    const reuse = await confirm('Use saved commit message?');
    if (reuse) {
      answers = { type, scope, subject, body, breaking };
    } else {
      clearDraft();
      print('');
    }
  }

  // ── Prompts (skipped if reusing draft) ─────────────────────────────────────
  if (!answers) {
    const type = await selectType();
    const scope = await getScope();
    const subject = await getSubject();
    const body = await getBody();
    const breaking = await getBreakingChange();
    answers = { type, scope, subject, body, breaking };
  }

  const { header, message } = buildMessage(answers);

  printPreview({ header, ...answers });

  const confirmed = await confirm('Confirm and commit?');
  rl.close();

  if (!confirmed) {
    clearDraft();
    print(`${DIM}  Aborted. Draft cleared.${RESET}`);
    process.exit(0);
  }

  // Save draft before attempting — if the commit hook rejects it the draft
  // survives and will be offered on the next run.
  saveDraft(answers);

  try {
    execSync(`git commit -m ${JSON.stringify(message)}`, { stdio: 'inherit' });
    clearDraft();
    print('');
    print(`${GREEN}  Committed successfully.${RESET}`);
  } catch {
    print('');
    print(`${RED}  Commit was rejected. Fix the errors above, then run:${RESET}`);
    print(`${YELLOW}  pnpm run commit${RESET}${DIM}  (your answers are saved)${RESET}`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
