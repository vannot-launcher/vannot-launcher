const assert = require('node:assert/strict');
const test = require('node:test');
const { filterOfficialVersions } = require('../src/version-filter');

const versions = [
  { id: '26.4-pre-1', type: 'snapshot' },
  { id: '26.3', type: 'release' },
  { id: 'b1.7.3', type: 'old_beta' },
  { id: 'rd-132211', type: 'old_alpha' }
];

test('shows every official version in the all-versions filter', () => {
  assert.deepEqual(filterOfficialVersions(versions, 'all'), versions);
  assert.deepEqual(filterOfficialVersions(versions, 'unknown'), versions);
});

test('filters official releases, snapshots, and legacy versions by manifest type', () => {
  assert.deepEqual(filterOfficialVersions(versions, 'release'), [versions[1]]);
  assert.deepEqual(filterOfficialVersions(versions, 'snapshot'), [versions[0]]);
  assert.deepEqual(filterOfficialVersions(versions, 'legacy'), [versions[2], versions[3]]);
});
