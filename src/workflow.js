// The EKA and its document view share the SAQ workflow seed and decision model.
// Source: ewgftju/saq-notification-test, 23c4c9d417fdc6302c1066de9291897bf798fa10.
import { makeSeed, users } from '../workflow/data.js';
import { actOnTask, canOpen, isTaskOverdue } from '../workflow/model.js';
import { workflowGrants } from '../workflow/access.js';

export const workflowUsers = users;
export const workflowStorageKey = 'saq.eka.workflow.v1';

const employeeIds = new Set(Object.keys(workflowGrants));
const sessionUserKey = 'saq.eka.workflow.employee';
const returnKey = 'saq.eka.workflow.return';
const hubUrl = new URL('../', import.meta.url);
const astanaDay = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit',
});
let memoryState;
let memoryUser = null;

export function isWorkflowDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isWorkflowTaskOverdue(task, now = Date.now()) {
  if (isWorkflowDateOnly(task?.dueAt)) {
    const date = new Date(task.dueAt).toJSON();
    return task.status === 'pending' && date?.slice(0, 10) === task.dueAt && task.dueAt < astanaDay.format(now);
  }
  return isTaskOverdue(task, now);
}

// The original demo based each of these deadlines on the first visit. Keep
// this list only to identify that version's persisted values.
const legacyDeadlineHours = {
  'task-program': 8,
  'task-program-final': 48,
  'task-prof-package': 24,
  'task-obj-request': -2,
  'task-sva-conclusion': 48,
  'task-obsolete': 24,
  'task-author-revision': 30,
  'task-appeal-result': 48,
  'task-subject-answer': 40,
  'task-sur-selection': 72,
  'task-audit-report': 48,
  'task-audit-request': 20,
  'task-prof-act': 48,
  'task-prof-checklist': 48,
  'task-prof-prescription': 50,
  'task-quality-materials': 72,
  'task-meeting': 24,
  'task-commission-position': 36,
  'task-obj-answer': 24,
};

export function migrateWorkflowDeadlines(state) {
  if (state.preferences?.demoDeadlinesVersion >= 1) return state;
  const createdAt = Date.parse(state.createdAt);
  const tasks = state.tasks.map(task => {
    const hours = legacyDeadlineHours[task?.id];
    if (!Number.isFinite(hours) || !Number.isFinite(createdAt) || !task.dueAt || task.dueSource) return task;
    const entityId = task.id === 'task-program-final' ? 'program' : task.id.slice(5);
    const oldDueAt = new Date(createdAt + hours * 3600000).toJSON();
    if (task.entityId !== entityId || task.routeId !== 'route-' + entityId || task.dueAt !== oldDueAt) return task;
    return { ...task, dueAt: null };
  });
  const notifications = state.notifications.filter(notice =>
    !(notice.id === 'notice-reminder' && notice.eventId === 'reminder-obj-request' && notice.taskId === 'task-obj-request'));
  return { ...state, tasks, notifications, preferences: { ...state.preferences, demoDeadlinesVersion: 1 } };
}

function sessionValue(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return key === sessionUserKey ? memoryUser : null;
  }
}

function activeEmployee() {
  const id = sessionValue(sessionUserKey);
  return employeeIds.has(id) ? id : null;
}

function save(state) {
  // A shared data set with a tab-scoped identity keeps other open roles out
  // of this tab. Direct document URLs never select an employee.
  const persisted = { ...state, activeUserId: null };
  memoryState = persisted;
  const raw = JSON.stringify(persisted);
  try {
    localStorage.setItem(workflowStorageKey, raw);
    try { sessionStorage.removeItem(workflowStorageKey); } catch { /* Local data is durable. */ }
  } catch {
    try { sessionStorage.setItem(workflowStorageKey, raw); } catch { /* In-memory view. */ }
  }
}

function readStoredWorkflow() {
  let raw = null;
  try { raw = sessionStorage.getItem(workflowStorageKey); } catch { /* Optional fallback. */ }
  if (!raw) {
    try { raw = localStorage.getItem(workflowStorageKey); } catch { /* In-memory view. */ }
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.schemaVersion === 1 && Array.isArray(parsed.entities) &&
          Array.isArray(parsed.tasks) && Array.isArray(parsed.notifications) && Number.isFinite(parsed.sequence)) {
        return parsed;
      }
    } catch { /* An unreadable prototype snapshot can be regenerated. */ }
  }
  return null;
}

export function getWorkflow() {
  let state = readStoredWorkflow();
  if (!state) {
    state = memoryState || makeSeed();
    save(state);
  }
  const migrated = migrateWorkflowDeadlines(state);
  if (migrated !== state) {
    // A later decision or read mark from another tab must survive this upgrade.
    // Display the corrected snapshot immediately and re-read under the writer lock.
    void writeWorkflow(() => {
      const latest = readStoredWorkflow() || state;
      const updated = migrateWorkflowDeadlines(latest);
      if (updated !== latest) save(updated);
    }).catch(() => { /* A subsequent read can retry storage migration. */ });
  }
  return { ...migrated, activeUserId: activeEmployee() };
}

export function setWorkflowUser(profileId) {
  const nextId = employeeIds.has(profileId) ? profileId : null;
  if (activeEmployee() !== nextId) {
    try { sessionStorage.removeItem(returnKey); } catch { /* Optional navigation context. */ }
  }
  memoryUser = nextId;
  try {
    if (nextId) sessionStorage.setItem(sessionUserKey, nextId);
    else sessionStorage.removeItem(sessionUserKey);
  } catch { /* Profile remains valid only in this view. */ }
  return nextId;
}

// All writers use the same named lock so a read mark in a second tab cannot
// overwrite a decision or activate a route twice.
async function writeWorkflow(change) {
  const locks = globalThis.navigator?.locks;
  return locks ? locks.request(workflowStorageKey, async () => change()) : change();
}

export function readNotices(profileId, ids) {
  return writeWorkflow(() => {
    if (!profileId || profileId !== activeEmployee() || !Array.isArray(ids)) return 0;
    const wanted = new Set(ids);
    const state = getWorkflow();
    const unread = state.notifications.filter(n => n.recipientId === profileId && !n.readAt && wanted.has(n.id) &&
      canOpenWorkflowDocument(state, profileId, n.entityId));
    if (unread.length) {
      const now = new Date().toISOString();
      for (const notice of unread) notice.readAt = now;
      save(state);
    }
    return unread.length;
  });
}

export function restartDemo() {
  return writeWorkflow(() => save(makeSeed()));
}

function hubReturnUrl(value) {
  if (value) {
    try {
      const url = new URL(value, hubUrl);
      if (url.origin === hubUrl.origin &&
          (url.pathname === hubUrl.pathname || url.pathname === hubUrl.pathname + 'index.html')) return url.href;
    } catch { /* Fall back to the workspace home. */ }
  }
  return hubUrl.href;
}

export function getWorkflowReturnUrl() {
  return hubReturnUrl(sessionValue(returnKey));
}

export function canOpenWorkflowDocument(state, profileId, entityId) {
  if (!profileId || profileId !== state.activeUserId || !employeeIds.has(profileId)) return false;
  const record = state.entities.find(entity => entity.id === entityId);
  return Boolean(record && workflowGrants[profileId].includes(record.module) && canOpen(state, entityId, profileId));
}

export function openWorkflowDocument(profileId, entityId) {
  if (!canOpenWorkflowDocument(getWorkflow(), profileId, entityId)) return false;
  try { sessionStorage.setItem(returnKey, hubReturnUrl(window.location.href)); } catch { /* Default return link. */ }
  const destination = new URL('workflow/', hubUrl);
  destination.hash = '/document/' + encodeURIComponent(entityId);
  window.location.assign(destination.href);
  return true;
}

export function applyWorkflowDecision(profileId, entityId, taskId, decision, comment, payload) {
  return writeWorkflow(() => {
    // Read once more on submission: another tab may have completed or returned the task.
    const state = getWorkflow();
    if (!canOpenWorkflowDocument(state, profileId, entityId) ||
        !state.tasks.some(task => task.id === taskId && task.entityId === entityId && task.recipientId === profileId)) {
      throw new Error('Это поручение недоступно в вашем профиле.');
    }
    const next = actOnTask(state, taskId, profileId, decision, comment, payload);
    save(next);
    return next;
  });
}
