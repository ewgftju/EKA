// saq-sva-test at 0f610e7585ced9242104de3c77cc3c8e1dcabb1a.
// Snapshot of initializeSvaEvents(initialSvaEvents), scoped to assigned objects.
const groupHead = 'Жукенов Каримжан Амангельдыевич'
const auditor12 = 'Государственный аудитор 12'

export const svaAuditors = [
  {
    id: 'auditor', sourceUserId: 'sva-group-head', sourcePerson: groupHead, name: groupHead,
    role: 'Руководитель группы аудита', org: 'Центральный аппарат', initials: 'ЖК', modules: ['evga', 'sva']
  },
  {
    id: 'sva-auditor', sourcePerson: auditor12, name: auditor12,
    role: 'Аудитор СВА', org: 'Служба внутреннего аудита', initials: 'А12', modules: ['sva']
  }
]

const trainingCenter = 'ГУ «Учебный центр аудита»'
const operationsCenter = 'ГУ «Центр хозяйственного обеспечения»'
const efficiencyAudits = [
  { number: 'СВА-260911', object: operationsCenter, stage: 'Заключительный этап' },
  { number: 'СВА-260923', object: trainingCenter, stage: 'Основной этап' },
  { number: 'СВА-260920', object: trainingCenter, stage: 'Предварительный этап' },
  { number: 'СВА-260910', object: operationsCenter, stage: 'Предварительный этап' },
  { number: 'СВА-260921', object: trainingCenter, stage: 'Завершен' },
  { number: 'СВА-260922', object: trainingCenter, stage: 'Завершен' }
]

const assignedObjects = [
  ...efficiencyAudits.map(record => ({
    ...record, objectId: 'obj-1', title: 'Аудит обоснованности оплаты работ за 2025 год',
    auditType: 'Аудит эффективности', responsible: groupHead, assigneeIds: ['auditor'],
    region: 'г. Астана', start: '2026-09-01', end: '2026-09-09',
    // These six single-object samples have matching object and event statuses.
    eventStatus: record.stage
  })),
  {
    number: 'СВА-260006', objectId: 'obj-15', title: 'Аудит соблюдения отраслевого законодательства',
    object: 'РГУ «Основная организация Ш»', auditType: 'Аудит соответствия',
    responsible: auditor12, assigneeIds: ['sva-auditor'], region: 'Жамбылская область',
    start: '2026-11-02', end: '2026-11-20', stage: 'Предварительный этап', eventStatus: 'Проект'
  }
]

// An object's initial stage is already populated on a draft event. Its planned
// dates can also be in the past while the audit remains open in the register.
function lifecycleOf(record) {
  if (record.eventStatus === 'Проект') return 'planned'
  if (record.stage === 'Завершен' || record.eventStatus === 'Завершен') return 'closed'
  return 'active'
}

export const svaCases = assignedObjects.map(record => ({
  ...record, id: record.number.replace('СВА-', 'sva-') + '-' + record.objectId,
  module: 'sva', role: 'Ответственный аудитор', stageSource: 'Этап по объекту',
  lifecycle: lifecycleOf(record),
  href: 'https://saq-sva-test.vercel.app/objects/' + encodeURIComponent(record.number) + '/' + encodeURIComponent(record.objectId)
}))
