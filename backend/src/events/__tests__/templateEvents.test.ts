import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emitTemplateImported, removeAllTemplateEventListeners, onTemplateImported } from '../templateEvents';

const payload = {
  importId: 'imp-test',
  userId: 'user-1',
  pages: ['landing'],
  components: ['hero'],
  durationMs: 1200,
};

test('template events emit and listen', (t) => {
  const events: any[] = [];
  const dispose = onTemplateImported((data) => events.push(data));
  emitTemplateImported(payload);
  dispose();

  assert.equal(events.length, 1);
  assert.equal(events[0].importId, 'imp-test');

  t.after(() => {
    removeAllTemplateEventListeners();
  });
});
