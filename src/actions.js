// Known module titles can be declined explicitly. Imported titles remain verbatim.
const directObjects = new Map([
  ['Программа аудита', ['программу аудита', 'программы аудита']],
  ['План аудита', ['план аудита', 'плана аудита']],
  ['Аудиторский отчёт', ['аудиторский отчёт', 'аудиторского отчёта']],
  ['Запрос материалов', ['запрос материалов', 'запроса материалов']],
  ['Пакет № 1 для ЕРСОП', ['пакет № 1 для ЕРСОП', 'пакета № 1 для ЕРСОП']],
  ['Сводное заключение КК СВА', ['сводное заключение КК СВА', 'сводного заключения КК СВА']],
  ['Решение по возражению', ['решение по возражению', 'решения по возражению']],
  ['Ответ ДВГА на запрос', ['ответ ДВГА на запрос', 'ответа ДВГА на запрос']],
  ['Материалы для контроля качества', ['материалы для контроля качества', 'материалов для контроля качества']],
  ['Результаты СУР для формирования перечня ВГА', ['результаты СУР для формирования перечня ВГА', 'результатов СУР для формирования перечня ВГА']]
])

const familiarizationObjects = new Map([
  ['Аудиторский отчёт', 'с аудиторским отчётом'],
  ['Акт о назначении профилактического контроля', 'с актом о назначении профилактического контроля'],
  ['Проверочный лист', 'с проверочным листом']
])

function wording(action, object, stage, stageObject = object) {
  return { action, title: `${action} ${object}`, stage: `${stage} ${stageObject}` }
}

function taskWording(actionId, document) {
  const title = (typeof document === 'string' ? document : document?.title)?.trim() || ''
  const quoted = title ? ` «${title}»` : ''
  const [object, genitive] = directObjects.get(title) || [`документ${quoted}`, `документа${quoted}`]

  switch (actionId) {
    case 'approve': return wording('Согласовать', object, 'Согласование', genitive)
    case 'approve-final': return wording('Утвердить', object, 'Утверждение', genitive)
    case 'revise': return wording('Доработать', object, 'Доработка', genitive)
    case 'acknowledge':
      return wording('Ознакомиться', familiarizationObjects.get(title) || `с документом${quoted}`, 'Ознакомление')
    case 'attendance': {
      const event = title === 'Заседание апелляционной комиссии' ? 'в заседании апелляционной комиссии' : `в мероприятии${quoted}`
      return wording('Подтвердить участие', event, 'Подтверждение участия')
    }
    case 'respond':
      if (title === 'Требование о представлении сведений')
        return wording('Предоставить', 'сведения по требованию', 'Предоставление', 'сведений по требованию')
      if (title === 'Предписание об устранении нарушений')
        return wording('Ответить', 'на предписание об устранении нарушений', 'Ответ')
      return wording('Ответить', `по документу${quoted}`, 'Ответ')
    case 'review-selection':
      if (title === 'Результаты СУР для формирования перечня ВГА')
        return wording('Рассмотреть', object, 'Рассмотрение', genitive)
      return wording('Рассмотреть', `отбор по документу${quoted}`, 'Рассмотрение', `отбора по документу${quoted}`)
    case 'review':
      if (title === 'Ответ о принятых мерах')
        return wording('Рассмотреть', 'ответ объекта', 'Рассмотрение', 'ответа объекта')
      if (title === 'Материалы обращения для комиссии')
        return wording('Представить', 'позицию по обращению', 'Представление', 'позиции по обращению')
      if (title === 'Требование о представлении сведений')
        return wording('Рассмотреть', 'ответ по требованию', 'Рассмотрение', 'ответа по требованию')
      if (title === 'Предписание об устранении нарушений')
        return wording('Рассмотреть', 'ответ по предписанию', 'Рассмотрение', 'ответа по предписанию')
      return wording('Рассмотреть', object, 'Рассмотрение', genitive)
    default: return wording('Открыть', object, 'Просмотр', genitive)
  }
}

export function describeTask(actionId, document) {
  const { action, title } = taskWording(actionId, document)
  return { action, title }
}

export function describeTaskStage(actionId, document) {
  return taskWording(actionId, document).stage
}
