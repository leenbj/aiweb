import { EventEmitter } from 'node:events';

export interface TemplateImportedPayload {
  importId: string;
  userId: string;
  pages: string[];
  components: string[];
  theme?: string;
  assetsBase?: string;
  durationMs: number;
  requestId?: string;
}

export interface TemplateImportFailedPayload {
  importId: string;
  userId: string;
  durationMs: number;
  error: unknown;
  details?: unknown;
  requestId?: string;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export const TEMPLATE_EVENTS = {
  Imported: 'template.imported',
  ImportFailed: 'template.import.failed',
} as const;

type EventName = (typeof TEMPLATE_EVENTS)[keyof typeof TEMPLATE_EVENTS];

export function emitTemplateImported(payload: TemplateImportedPayload) {
  emitter.emit(TEMPLATE_EVENTS.Imported, payload);
}

export function emitTemplateImportFailed(payload: TemplateImportFailedPayload) {
  emitter.emit(TEMPLATE_EVENTS.ImportFailed, payload);
}

export function onTemplateImported(listener: (payload: TemplateImportedPayload) => void) {
  emitter.on(TEMPLATE_EVENTS.Imported, listener);
  return () => emitter.off(TEMPLATE_EVENTS.Imported, listener);
}

export function onTemplateImportFailed(listener: (payload: TemplateImportFailedPayload) => void) {
  emitter.on(TEMPLATE_EVENTS.ImportFailed, listener);
  return () => emitter.off(TEMPLATE_EVENTS.ImportFailed, listener);
}

export function onceTemplateImported(listener: (payload: TemplateImportedPayload) => void) {
  emitter.once(TEMPLATE_EVENTS.Imported, listener);
}

export function onceTemplateImportFailed(listener: (payload: TemplateImportFailedPayload) => void) {
  emitter.once(TEMPLATE_EVENTS.ImportFailed, listener);
}

export function removeTemplateImportedListener(listener: (payload: TemplateImportedPayload) => void) {
  emitter.off(TEMPLATE_EVENTS.Imported, listener);
}

export function removeTemplateImportFailedListener(listener: (payload: TemplateImportFailedPayload) => void) {
  emitter.off(TEMPLATE_EVENTS.ImportFailed, listener);
}

export function removeAllTemplateEventListeners(event?: EventName) {
  if (event) {
    emitter.removeAllListeners(event);
  } else {
    emitter.removeAllListeners();
  }
}
