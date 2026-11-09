import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { FileChange } from '../types'

const PANE = 'changes-notes'
// Change the tag when FileChange's fields change.
const changes = atom({ plugin: 'changes-notes', key: 'changes' } as const, [], {
  shape: 'changes-1',
})

type Hunk = { lines: string[] }

function countLines(hunks: readonly Hunk[] | undefined) {
  let added = 0
  let removed = 0
  for (const hunk of hunks ?? []) {
    for (const line of hunk.lines) {
      if (line.startsWith('+')) added++
      else if (line.startsWith('-')) removed++
    }
  }
  return { added, removed }
}

async function record(
  $: EngineInterface,
  path: string,
  added: number,
  removed: number,
  isNew: boolean,
) {
  await update($, changes, list => {
    const old = list.find(one => one.path === path)
    const next: FileChange = old
      ? { path, added: old.added + added, removed: old.removed + removed, isNew: old.isNew || isNew }
      : { path, added, removed, isNew }
    return [...list.filter(one => one.path !== path), next]
  })
}

export const register: Register = on => {
  let cwd = ''

  on('session.start', async ($, e, next) => {
    cwd = await $.session.cwd()
    await $.command.register({
      name: 'notes',
      description: 'Open the changes + notes pane',
    })
    void $.ui.open({ id: PANE, title: 'Changes & notes' })
    return next(e)
  })

  on('command.run', { command: 'notes' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Changes & notes', focus: true })
    return { text: 'Changes & notes pane opened.' }
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.result && !ran.isError) {
      const { added, removed } = countLines(ran.result.structuredPatch)
      await record($, ran.result.filePath, added, removed, false)
    }
    return ran
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.result && !ran.isError && !ran.result.staged) {
      const r = ran.result
      const isNew = r.type === 'create'
      const counts =
        isNew && r.structuredPatch.length === 0
          ? { added: r.content.split('\n').length, removed: 0 }
          : countLines(r.structuredPatch)
      await record($, r.filePath, counts.added, counts.removed, isNew)
    }
    return ran
  })

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.result && !ran.isError) await record($, e.notebook_path, 0, 0, false)
    return ran
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    const diff = ran.result && !ran.isError ? ran.result.bashEditDiff : undefined
    if (diff) {
      const seen = new Set<string>()
      for (const file of diff.files) {
        seen.add(file.filePath)
        const { added, removed } = countLines(file.hunks)
        await record($, file.filePath, added, removed, file.created === true)
      }
      for (const path of diff.changedFiles ?? []) {
        if (!seen.has(path)) await record($, path, 0, 0, false)
      }
    }
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, changes)
    const rows = Math.max(10, e.props.scroll.bodyRows)
    const width = Math.max(20, e.props.bodyColumns)

    // Top half: file changes. Bottom half: notes.
    const topRows = Math.max(3, Math.floor(rows / 2))
    const fileRows = topRows - 2
    const shown = list.slice(-fileRows)
    const hidden = list.length - shown.length
    const noteRows = Math.max(3, rows - topRows - 1)

    const rel = (path: string) =>
      cwd && path.startsWith(cwd + '/') ? path.slice(cwd.length + 1) : path
    const fit = (text: string, room: number) =>
      text.length <= room ? text : '…' + text.slice(text.length - room + 1)

    const totalAdded = list.reduce((sum, one) => sum + one.added, 0)
    const totalRemoved = list.reduce((sum, one) => sum + one.removed, 0)

    return (
      <Box flexDirection="column">
        <Box flexDirection="column" height={topRows}>
          <Text bold>
            {list.length === 0
              ? 'No change in this session'
              : `${list.length} file${list.length === 1 ? '' : 's'} changed `}
            {list.length > 0 && <Text color="green">+{totalAdded} </Text>}
            {list.length > 0 && <Text color="red">-{totalRemoved}</Text>}
          </Text>
          {hidden > 0 && <Text dimColor>{hidden} more above</Text>}
          {shown.map(one => {
            const counts = `+${one.added} -${one.removed}`
            const label = fit(rel(one.path), width - counts.length - 4)
            return (
              <Box flexDirection="row" justifyContent="space-between">
                <Text>
                  {one.isNew ? <Text color="green">A </Text> : <Text color="yellow">M </Text>}
                  {label}
                </Text>
                <Text>
                  <Text color="green">+{one.added}</Text> <Text color="red">-{one.removed}</Text>
                </Text>
              </Box>
            )
          })}
        </Box>
        <Text dimColor>{'─'.repeat(width)}</Text>
        {e.surface === 'terminal' && (() => {
          const { Client } = $.ui.resolve(e)
          return <Client key="notes" module="./notes-editor.tsx" height={noteRows} width="100%" />
        })()}
      </Box>
    )
  })
}
