#!/usr/bin/env node

/**
 * Developer-friendly CLI manager for Timmbr local infrastructure.
 * Wraps Docker Compose with structured service status, connection strings,
 * and clickable web UI links.
 */

import { spawn, execSync } from 'node:child_process';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const GRAY = '\x1b[90m';

const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
const padEndAnsi = (str, targetLength) => {
  const visible = stripAnsi(str).length;
  return str + ' '.repeat(Math.max(0, targetLength - visible));
};

const SERVICES = [
  {
    key: 'postgres',
    name: 'PostgreSQL',
    port: 'localhost:5432',
    details: 'user: timmbr | db: timmbr_dev',
    url: null,
  },
  {
    key: 'redis',
    name: 'Redis',
    port: 'localhost:6379',
    details: 'redis://localhost:6379',
    url: null,
  },
  {
    key: 'mailpit',
    name: 'Mailpit (Email)',
    port: 'localhost:1025 (SMTP)',
    details: 'Web UI: http://localhost:8025',
    url: 'http://localhost:8025',
  },
  {
    key: 'redis-insight',
    name: 'Redis Insight',
    port: 'localhost:5540',
    details: 'Dashboard for Redis keys & cache',
    url: 'http://localhost:5540',
    isTool: true,
  },
];

function runCommand(command, args, inherit = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    if (!inherit) {
      child.stdout?.on('data', (data) => (stdout += data.toString()));
      child.stderr?.on('data', (data) => (stderr += data.toString()));
    }

    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `Command exited with code ${code}`));
    });

    child.on('error', reject);
  });
}

function getRunningContainers() {
  try {
    const raw = execSync('docker compose --profile "*" ps --format json', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = raw.trim().split('\n').filter(Boolean);
    const containers = [];

    for (const line of lines) {
      try {
        containers.push(JSON.parse(line));
      } catch {
        // Skip unparseable lines
      }
    }

    return containers;
  } catch {
    return null;
  }
}

function printBanner() {
  console.log(`\n${CYAN}┌────────────────────────────────────────────────────────────────────────┐${RESET}`);
  console.log(`${CYAN}│${RESET}                     ${BOLD}Timmbr Local Infrastructure${RESET}                        ${CYAN}│${RESET}`);
  console.log(`${CYAN}└────────────────────────────────────────────────────────────────────────┘${RESET}\n`);
}

function printStatusDashboard() {
  const containers = getRunningContainers();

  if (containers === null) {
    console.log(`${RED}❌ Docker is not running or accessible. Please ensure Docker Desktop is started.${RESET}\n`);
    return;
  }

  printBanner();

  console.log(`  ${BOLD}${padEndAnsi('Service', 20)} ${padEndAnsi('Status', 18)} ${padEndAnsi('Port / Endpoint', 24)} ${'Details'}${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(80)}${RESET}`);

  for (const svc of SERVICES) {
    const running = containers.find(
      (c) => c.Service === svc.key || c.Name?.includes(svc.key) || c.Names?.includes(svc.key),
    );

    const isUp = running && (running.State === 'running' || running.Status?.toLowerCase().includes('up'));
    const isHealthy = running && running.Health === 'healthy';

    let statusBadge;
    if (isUp) {
      statusBadge = isHealthy
        ? `${GREEN}● Healthy${RESET}`
        : `${GREEN}● Running${RESET}`;
    } else {
      statusBadge = svc.isTool
        ? `${GRAY}○ Inactive (tool)${RESET}`
        : `${YELLOW}○ Stopped${RESET}`;
    }

    let detailText = svc.details;
    if (svc.isTool && !isUp) {
      detailText = `${DIM}Run: pnpm infra:tools${RESET}`;
    } else if (svc.url) {
      detailText = `${CYAN}${svc.url}${RESET}`;
    }

    console.log(
      `  ${padEndAnsi(svc.name, 20)} ${padEndAnsi(statusBadge, 18)} ${padEndAnsi(svc.port, 24)} ${detailText}`,
    );
  }

  console.log(`  ${DIM}${'─'.repeat(80)}${RESET}\n`);

  console.log(`  ${BOLD}Useful Shortcuts:${RESET}`);
  console.log(`  ${DIM}•${RESET} Mailpit Web UI:        ${CYAN}http://localhost:8025${RESET}`);
  const insightActive = containers.some((c) => c.Service === 'redis-insight' || c.Name?.includes('redis-insight'));
  if (insightActive) {
    console.log(`  ${DIM}•${RESET} Redis Insight:         ${CYAN}http://localhost:5540${RESET}`);
  } else {
    console.log(`  ${DIM}•${RESET} Launch Redis Insight:  ${YELLOW}pnpm infra:tools${RESET} (opens ${CYAN}http://localhost:5540${RESET})`);
  }
  console.log(`  ${DIM}•${RESET} Restore Database:      ${YELLOW}pnpm db:restore:dump${RESET}`);
  console.log(`  ${DIM}•${RESET} View Logs:             ${YELLOW}pnpm infra:logs${RESET}`);
  console.log(`  ${DIM}•${RESET} Stop All:              ${YELLOW}pnpm infra:down${RESET}\n`);
}

async function main() {
  const action = process.argv[2] || 'status';

  switch (action) {
    case 'up': {
      console.log(`\n${BLUE}🚀 Starting Timmbr local infrastructure (Postgres, Redis, Mailpit)...${RESET}`);
      await runCommand('docker', ['compose', 'up', '-d'], true);
      printStatusDashboard();
      break;
    }

    case 'tools': {
      console.log(`\n${BLUE}🚀 Starting Timmbr local infrastructure + Redis Insight...${RESET}`);
      await runCommand('docker', ['compose', '--profile', 'tools', 'up', '-d'], true);
      printStatusDashboard();
      break;
    }

    case 'status': {
      printStatusDashboard();
      break;
    }

    case 'down': {
      console.log(`\n${YELLOW}🛑 Stopping all Timmbr local infrastructure and tools...${RESET}`);
      await runCommand('docker', ['compose', '--profile', '*', 'down'], true);
      console.log(`\n${GREEN}✔ All containers, tools, and networks stopped cleanly.${RESET}\n`);
      break;
    }

    case 'logs': {
      console.log(`\n${BLUE}📋 Streaming logs for all services (Ctrl+C to exit)...${RESET}\n`);
      await runCommand('docker', ['compose', '--profile', '*', 'logs', '-f'], true);
      break;
    }

    default: {
      console.error(`\n${RED}Unknown action: "${action}"${RESET}`);
      console.log(`Usage: node scripts/infra.mjs [up | tools | status | down | logs]\n`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(`\n${RED}❌ Error running infra command:${RESET}`, err.message || err);
  process.exit(1);
});
