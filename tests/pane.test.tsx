import { expect, test } from 'claude-code/testing'

test('the pane draws the changes header and a notes box', async ($, on) => {
  on('command.register', () => ({ value: { command: 'notes' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.cwd', () => ({ value: '/p' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({
    plugin: 'changes-notes', component: 'Pane', requestId: 'changes-notes', surface: 'terminal',
    props: { title: 'Changes & notes', isFocused: false, bodyColumns: 40, placement: 'dock',
      scroll: { offset: 0, bodyRows: 20 }, view: {} },
  })
  expect((await ui.find({ type: 'Text', text: /No change/ }))?.text).toBe('No change in this session')
  expect(await ui.find({ type: "Client", key: "notes" })).toBeTruthy()
  await ui.unmount()
})

test('Enter in the notes adds a new line', async ($, on) => {
  on('command.register', () => ({ value: { command: 'notes' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.cwd', () => ({ value: '/p' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({
    plugin: 'changes-notes', component: 'Pane', requestId: 'changes-notes', surface: 'terminal',
    props: { title: 'Changes & notes', isFocused: true, bodyColumns: 40, placement: 'dock',
      scroll: { offset: 0, bodyRows: 20 }, view: {} },
  })
  for (const key of ['h', 'i', 'return', 'y', 'space', 'o']) await ui.key({ key, in: 'notes' })
  const rows = JSON.stringify(await ui.drawn({ in: 'notes' }))
  expect(rows).toContain('"hi"')
  expect(rows).toContain('"y o"')
  await ui.unmount()
})
