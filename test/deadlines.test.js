import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSeed } from '../workflow/data.js'
import { actOnTask, readNotification } from '../workflow/model.js'
import {
  getWorkflow, isWorkflowDateOnly, isWorkflowTaskOverdue, migrateWorkflowDeadlines, workflowStorageKey
} from '../src/workflow.js'

const anchor = new Date('2026-11-12T06:04:31.217Z')
const at = hours => new Date(anchor.getTime() + hours * 3600000).toISOString()
const legacyHours = {
  program: 8, 'program-final': 48, 'prof-package': 24, 'obj-request': -2, 'sva-conclusion': 48,
  obsolete: 24, 'author-revision': 30, 'appeal-result': 48, 'subject-answer': 40, 'sur-selection': 72,
  'audit-report': 48, 'audit-request': 20, 'prof-act': 48, 'prof-checklist': 48, 'prof-prescription': 50,
  'quality-materials': 72, meeting: 24, 'commission-position': 36, 'obj-answer': 24,
}

function oldSnapshot() {
  const state = makeSeed(anchor)
  delete state.preferences.demoDeadlinesVersion
  for (const [entity, hours] of Object.entries(legacyHours)) {
    state.tasks.find(t => t.id === 'task-' + entity).dueAt = at(hours)
  }
  state.notifications.push({
    id: 'notice-reminder', eventId: 'reminder-obj-request', taskId: 'task-obj-request', entityId: 'obj-request',
    actorId: 'system', recipientId: 'reviewer', module: 'objections', category: 'deadline', version: '1',
    createdAt: at(-0.05), readAt: null,
  })
  return state
}

test('all new demo task types open without a deadline or fabricated reminder', () => {
  const state = makeSeed(anchor)
  assert.ok(state.tasks.length)
  assert.ok(state.tasks.every(task => task.dueAt === null))
  assert.ok(!state.notifications.some(note => note.id === 'notice-reminder'))
  assert.ok(state.entities.find(entity => entity.id === 'meeting').content.includes('14.11.2026 в 15:00'))
})

test('every old demo offset is removed, including on activated or closed steps, while decisions and reads survive', () => {
  let legacy = oldSnapshot()
  readNotification(legacy, 'notice-sur-ready', 'reviewer', at(0))
  legacy = actOnTask(legacy, 'task-program', 'reviewer', 'approve', '', {}, at(1))
  legacy = actOnTask(legacy, 'task-prof-package', 'reviewer', 'return', 'Уточните приложение.', {}, at(2))
  const revision = legacy.tasks.find(t => t.entityId === 'prof-package' && t.action === 'revise')
  legacy = actOnTask(legacy, revision.id, 'author', 'resubmit', 'Приложение исправлено.', {}, at(3))

  const snapshotBefore = structuredClone(legacy)
  const updated = migrateWorkflowDeadlines(legacy)
  assert.deepEqual(legacy, snapshotBefore)
  assert.deepEqual(updated, {
    ...snapshotBefore,
    tasks: snapshotBefore.tasks.map(task => ({ ...task, dueAt: null })),
    notifications: snapshotBefore.notifications.filter(n => n.id !== 'notice-reminder'),
    preferences: { ...snapshotBefore.preferences, demoDeadlinesVersion: 1 },
  })
  assert.equal(migrateWorkflowDeadlines(updated), updated)
})

test('matching dates with an explicit source, edited dates, other routes and new assignments survive', () => {
  const legacy = oldSnapshot()
  const withSource = legacy.tasks.find(t => t.id === 'task-audit-request')
  withSource.dueSource = { module: 'evga', field: 'request.general.deadline' }
  const edited = legacy.tasks.find(t => t.id === 'task-sva-conclusion')
  edited.dueAt = at(48.5)
  const otherRoute = legacy.tasks.find(t => t.id === 'task-obj-answer')
  otherRoute.routeId = 'route-replacement'
  const custom = { ...legacy.tasks[0], id: 'task-unrelated', dueSource: null }
  legacy.tasks.push(custom)
  const message = { ...legacy.notifications.at(-1), id: 'notice-application-deadline', eventId: 'deadline-from-case' }
  legacy.notifications.push(message)

  const migrated = migrateWorkflowDeadlines(legacy)
  for (const task of [withSource, edited, otherRoute, custom]) {
    assert.deepEqual(migrated.tasks.find(t => t.id === task.id), task)
  }
  assert.ok(migrated.notifications.includes(message))
  const sourceDeadlineAssignedLater = migrated.tasks.find(t => t.id === 'task-obj-request')
  sourceDeadlineAssignedLater.dueAt = at(-2)
  assert.equal(migrateWorkflowDeadlines(migrated).tasks.find(t => t.id === 'task-obj-request').dueAt, at(-2))
})

test('an action never grants a fresh deadline to its successor, including a new document revision', () => {
  const state = makeSeed(anchor)
  state.tasks.find(t => t.id === 'task-program').dueAt = at(5)
  const approved = actOnTask(state, 'task-program', 'reviewer', 'approve', '', {}, at(6))
  assert.equal(approved.tasks.find(t => t.id === 'task-program-final').dueAt, null)
  const returned = actOnTask(state, 'task-program', 'reviewer', 'return', 'Уточните период.', {}, at(6))
  const revise = returned.tasks.find(t => t.entityId === 'program' && t.action === 'revise')
  assert.equal(revise.dueAt, null)
  const resubmitted = actOnTask(returned, revise.id, 'author', 'resubmit', 'Период уточнён.', {}, at(7))
  const review = resubmitted.tasks.find(t => t.entityId === 'program' && t.version === '2')
  assert.equal(review.dueAt, null)
  assert.equal(review.status, 'pending')
  assert.equal(resubmitted.tasks.find(t => t.id === 'task-program').dueAt, at(5))
})

test('only pending tasks with a real due time or a past calendar date in Astana are overdue', () => {
  const task = { status: 'pending', dueAt: '2026-11-12' }
  assert.equal(isWorkflowDateOnly(task.dueAt), true)
  assert.equal(isWorkflowDateOnly(at(0)), false)
  assert.equal(isWorkflowTaskOverdue(task, Date.parse('2026-11-12T18:59:59Z')), false)
  assert.equal(isWorkflowTaskOverdue(task, Date.parse('2026-11-12T19:00:00Z')), true)
  assert.equal(isWorkflowTaskOverdue({ ...task, dueAt: at(1) }, anchor), false)
  assert.equal(isWorkflowTaskOverdue({ ...task, dueAt: at(0) }, anchor), true)
  for (const status of ['completed', 'returned', 'waiting', 'cancelled', 'rejected']) {
    assert.equal(isWorkflowTaskOverdue({ ...task, status }, Date.parse(at(48))), false)
  }
  for (const dueAt of [null, undefined, '', 'invalid', '2026-02-31']) {
    assert.equal(isWorkflowTaskOverdue({ ...task, dueAt }, anchor), false)
  }
})

function installGlobal(t, name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { configurable: true, value })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous)
    else delete globalThis[name]
  })
}

test('a migration waiting for another tab re-reads and persists the latest decision', async t => {
  const storage = new Map()
  const local = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }
  const queued = []
  installGlobal(t, 'localStorage', local)
  installGlobal(t, 'sessionStorage', { getItem: () => null, removeItem() {} })
  installGlobal(t, 'navigator', { locks: { request: (_, callback) => {
    return new Promise(resolve => queued.push(() => resolve(callback())))
  } } })

  const legacy = oldSnapshot()
  local.setItem(workflowStorageKey, JSON.stringify(legacy))
  const visible = getWorkflow()
  assert.ok(visible.tasks.every(task => task.dueAt === null))
  assert.ok(!visible.notifications.some(note => note.id === 'notice-reminder'))

  const otherTab = actOnTask(JSON.parse(local.getItem(workflowStorageKey)), 'task-program', 'reviewer', 'approve', '', {}, at(1))
  local.setItem(workflowStorageKey, JSON.stringify(otherTab))
  assert.equal(queued.length, 1)
  await queued[0]()
  const persisted = JSON.parse(local.getItem(workflowStorageKey))
  assert.equal(persisted.tasks.find(t => t.id === 'task-program-final').status, 'pending')
  assert.deepEqual(persisted.entities, otherTab.entities)
  assert.deepEqual(persisted.notifications, otherTab.notifications.filter(n => n.id !== 'notice-reminder'))
  assert.ok(persisted.tasks.every(task => task.dueAt === null))
})
