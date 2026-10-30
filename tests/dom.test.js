import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oreMinuti } from '../js/ui/dom.js';

test('ore di volo in ore:minuti, come il formato [h]:mm dell\'Excel', () => {
  assert.equal(oreMinuti(165), '2:45');
  assert.equal(oreMinuti(0), '0:00');
  assert.equal(oreMinuti(600), '10:00');
});
