#!/usr/bin/env node
/**
 * Run a shell command on the production box.
 *
 * There is no SSH: port 22 is closed and no key exists. Every remote step goes
 * through SSM Run Command, which is a send-then-poll API, so doing it by hand
 * is three calls and a sleep loop. This is that loop.
 *
 *   node scripts/box.mjs 'docker ps'
 *   echo 'multi-line script' | node scripts/box.mjs -
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const INSTANCE = process.env.GS_INSTANCE_ID ?? 'i-0cc1f215b9bb900ad';
const REGION = process.env.AWS_REGION ?? 'eu-west-2';

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node scripts/box.mjs '<command>'   (or '-' to read stdin)");
  process.exit(2);
}
const script = arg === '-' ? readFileSync(0, 'utf8') : arg;

const aws = (args) =>
  JSON.parse(
    execFileSync('aws', [...args, '--region', REGION, '--output', 'json'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    }),
  );

const sent = aws([
  'ssm', 'send-command',
  '--instance-ids', INSTANCE,
  '--document-name', 'AWS-RunShellScript',
  '--parameters', JSON.stringify({ commands: [script], executionTimeout: ['3600'] }),
]);
const id = sent.Command.CommandId;

// SSM has no blocking wait that survives a long command, so poll. The status is
// only meaningful once it leaves the in-flight set.
const inFlight = new Set(['Pending', 'InProgress', 'Delayed']);
const deadline = Date.now() + 60 * 60 * 1000;
for (;;) {
  await new Promise((r) => setTimeout(r, 4000));
  let out;
  try {
    out = aws(['ssm', 'get-command-invocation', '--command-id', id, '--instance-id', INSTANCE]);
  } catch {
    continue; // the invocation is not registered for a moment after send
  }
  if (inFlight.has(out.Status)) {
    if (Date.now() > deadline) { console.error('timed out'); process.exit(1); }
    continue;
  }
  if (out.StandardOutputContent) process.stdout.write(out.StandardOutputContent);
  if (out.StandardErrorContent) process.stderr.write(out.StandardErrorContent);
  console.error(`\n[${out.Status}] exit ${out.ResponseCode}`);
  process.exit(out.ResponseCode === 0 ? 0 : 1);
}
