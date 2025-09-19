import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createStreamEmitter } from '../streamEmitter';

class ResponseStub {
  public readonly headers: Record<string, any> = {};
  public chunks: string[] = [];
  public ended = false;

  setHeader(key: string, value: any) {
    this.headers[key.toLowerCase()] = value;
  }

  write(chunk: string) {
    this.chunks.push(chunk);
  }

  end() {
    this.ended = true;
  }
}

const emitters: Array<{ close: () => void }> = [];

afterEach(() => {
  for (const emitter of emitters.splice(0)) {
    emitter.close();
  }
});

test('StreamEmitter emits schema event immediately', () => {
  const res = new ResponseStub();
  const emitter = createStreamEmitter(res as any);
  emitters.push(emitter);
  const output = res.chunks.join('');
  assert.ok(output.includes('"type":"schema"'));
  assert.equal(res.headers['content-type'], 'text/event-stream');
});

test('StreamEmitter emits stage/log/complete events', () => {
  const res = new ResponseStub();
  const emitter = createStreamEmitter(res as any, { includeTimestamp: false });
  emitters.push(emitter);

  emitter.stage('planner', 'start', { attempt: 1 });
  emitter.log('info', 'planning', { attempt: 1 });
  emitter.complete({ html: '<html></html>' });

  const payload = res.chunks.join('');
  assert.ok(payload.includes('"type":"stage"'));
  assert.ok(payload.includes('"stage":"planner"'));
  assert.ok(payload.includes('"type":"log"'));
  assert.ok(payload.includes('"type":"complete"'));
  assert.equal((res as any).ended, true);
});
