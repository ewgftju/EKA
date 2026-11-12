// Initial state of saq-evga-test at 26df80bb9ebcdd29007803eebcccc0203549ca39.
// See src/modules/evga/useAuditCases.ts, demoScenario.ts and executionProgress.ts.
export const evgaAuditor = {
  sourcePersonId: 'auditor',
  sourcePerson: 'Жукенов Каримжан Амангельдыевич',
  position: 'Руководитель рабочей группы центрального аппарата'
}

const preparation = 'Подготовительный этап'
const main = 'Основной этап'
const preparationStep = 'Подготовка документов этапа'
const deliveryStep = 'Подписание реестра объектом аудита'
const createIrpi = 'Информация о результатах предварительного изучения: Создать и заполнить документ'
const generalPurpose = 'Проверка подтверждения объёмов оплаченных работ за 2025 год'
const operationsCenter = 'ГУ «Центр хозяйственного обеспечения»'
const auditCenter = 'ГУ «Учебный центр аудита»'

const cases = [
  {
    id: 'case-2026-0910', number: '30101-26-0910', object: operationsCenter,
    documentCount: 1, stage: preparation, nextStep: preparationStep,
    nextAction: 'Информация о результатах предварительного изучения: Отправить документ на согласование'
  },
  {
    id: 'case-2026-0923', number: '30101-26-0923', object: auditCenter,
    documentCount: 10, stage: main, nextStep: preparationStep,
    nextAction: 'Аудиторский отчет: Направить отчёт на подписание рабочей группе'
  },
  {
    id: 'case-execution-2026-0930', number: '30101-26-0930', object: 'ГУ «Учебный центр исполнения»',
    documentCount: 16, stage: main, nextStep: deliveryStep, nextAction: 'Направить реестр объекту аудита'
  },
  {
    id: 'case-2026-0911', number: '30101-26-0911', object: operationsCenter,
    documentCount: 18, stage: main, nextStep: deliveryStep, nextAction: 'Направить реестр объекту аудита'
  },
  ...['start', 'full'].map((variant, index) => ({
    id: 'case-registry-2026-' + variant, number: '30101-26-105' + index, object: operationsCenter,
    documentCount: 6, stage: main, nextStep: preparationStep,
    nextAction: 'Аудиторский отчет: Создать и заполнить документ'
  })),
  {
    id: 'case-2026-0920', number: '30101-26-0920', object: auditCenter,
    documentCount: 0, stage: preparation, nextStep: preparationStep, nextAction: createIrpi
  },
  {
    id: 'case-2026-0921', number: '30101-26-0921', object: auditCenter,
    documentCount: 20, eventStatus: 'Закрыто'
  },
  {
    id: 'case-2026-0922', number: '30101-26-0922', object: auditCenter,
    documentCount: 17, eventStatus: 'Закрыто'
  }
]

const plannedObjects = [
  'ГУ «Учебный центр инфраструктуры»',
  'ГУ «Учебный центр государственных закупок»',
  'ГУ «Учебный центр финансовой отчетности»',
  'ГУ «Учебный центр бухгалтерского учета»'
]

// These eight case cards have a stored audit.schedule. Its start/end are the
// period of the audit. The dates of fixture generation are browser-dependent.
for (const [index, object] of plannedObjects.entries()) {
  const number = '30101-26-10' + (index + 1)
  const id = 'case-planned-2026-' + (index + 1)
  const common = {
    object, checkType: 'Плановый', start: '2026-09-01', end: '2026-09-11',
    title: index < 2
      ? 'Проверка соответствия расходов на выполнение работ за 2025 год'
      : 'Оценка достоверности финансовой отчетности за 2025 год'
  }
  cases.push(
    {
      ...common, id: id + '-start', number: number + '0', documentCount: 0,
      stage: preparation, nextStep: preparationStep, nextAction: createIrpi
    },
    {
      ...common, id: id + '-full', number: number + '1', documentCount: 18, eventStatus: 'Закрыто'
    }
  )
}

export const evgaCases = cases.map(item => {
  const eventStatus = item.eventStatus || 'Открыто'
  // Some open cases contain only a created case card. Show them outside
  // started work. Закрыто is an explicit status set by the source workflow.
  const lifecycle = eventStatus === 'Закрыто' ? 'closed' : item.documentCount > 0 ? 'active' : 'planned'
  return {
    title: generalPurpose, checkType: 'Внеплановый', start: null, end: null,
    stage: null, nextStep: null, nextAction: null, ...item,
    eventStatus, lifecycle, module: 'evga',
    assigneeIds: ['auditor'], createdById: 'auditor', author: evgaAuditor.sourcePerson,
    responsible: evgaAuditor.sourcePerson, role: 'Автор дела, руководитель рабочей группы',
    stageSource: 'Ход исполнения',
    href: 'https://saq-evga-test.vercel.app/#/cases/' + item.id + '/progress'
  }
})
