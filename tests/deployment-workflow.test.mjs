import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';

const workflow = yaml.load(await readFile('.github/workflows/ci.yml', 'utf8'));
const deploy = workflow.jobs.deploy;

test('Production credentials are gated behind verified trusted main pushes and explicit enablement', () => {
  assert.deepEqual(Object.keys(workflow.on).sort(), ['pull_request', 'push', 'workflow_dispatch']);
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.equal(deploy.needs, 'verify');
  assert.equal(
    deploy.if,
    "github.repository == 'getzipzi/zipzi-site' && github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.ZIPZI_DEPLOY_ENABLED == 'true'"
  );
  assert.equal(deploy.environment, 'production');
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(deploy.permissions, { contents: 'read', actions: 'read' });
  assert.equal(workflow.concurrency['cancel-in-progress'], "${{ github.event_name == 'pull_request' }}");
  assert.equal(deploy.concurrency['cancel-in-progress'], false);
  assert.equal(deploy.concurrency.group, 'zipzi-site-production');
  assert.doesNotMatch(JSON.stringify(workflow.jobs.verify), /secrets\./);
  assert.ok(workflow.jobs.verify.steps.some((step) => step.run?.includes('deployment job is skipped')));
});

test('Deployment consumes the same run artifact without rebuilding or changing server configuration', () => {
  const runs = deploy.steps.map((step) => step.run ?? '').join('\n');
  assert.ok(runs.includes('gh run download "$GITHUB_RUN_ID"'));
  assert.ok(runs.includes('--repo "$GITHUB_REPOSITORY" --name "zipzi-site-$GITHUB_SHA"'));
  assert.ok(runs.includes('python3 -I tooling/deploy/client.py incoming'));
  assert.doesNotMatch(runs, /npm |rsync|scp |nginx|systemctl|ssh-keyscan|curl/);
  const checkout = deploy.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ github.sha }}');
  assert.equal(checkout.with['persist-credentials'], false);
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps) {
      if (step.uses) assert.match(step.uses, /^actions\/[\w-]+@[a-f0-9]{40}$/);
    }
  }
  assert.ok(workflow.jobs.verify.steps.some((step) => step.run === 'npm run test:deploy'));
  assert.ok(workflow.jobs.verify.steps.some((step) => step.run?.includes('sudo -n /usr/bin/python3')));
});
