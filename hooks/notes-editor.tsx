import type { ClientKeyEvent, ClientModule } from 'claude-code'

// A plain text area: click it, then type. Enter adds a new line.
// The text lives only in this instance; nothing is saved.
type State = { text: string; cursor: number }

const IGNORED = /^(f\d{1,2}|insert|pageup|pagedown|escape|clear|tab)$/

// Splits the text into the rows drawn, wrapping long lines at `width`.
// Each row is [start, end) in the text.
function layout(text: string, width: number): [number, number][] {
  const rows: [number, number][] = []
  let start = 0
  for (const line of text.split('\n')) {
    if (line.length === 0) rows.push([start, start])
    for (let at = 0; at < line.length; at += width) {
      rows.push([start + at, start + Math.min(line.length, at + width)])
    }
    start += line.length + 1
  }
  return rows
}

// The row the cursor sits on. At a wrap point it belongs to the next row.
function rowOf(rows: [number, number][], cursor: number): number {
  for (let i = 0; i < rows.length; i++) {
    const [start, end] = rows[i]!
    const next = rows[i + 1]
    if (cursor >= start && cursor <= end && !(cursor === end && next && next[0] === end)) {
      return i
    }
  }
  return rows.length - 1
}

function edit(s: State, k: ClientKeyEvent, width: number): State | undefined {
  const { text, cursor } = s
  const insert = (str: string) => ({
    text: text.slice(0, cursor) + str + text.slice(cursor),
    cursor: cursor + str.length,
  })
  if (k.ctrl || k.meta) return undefined
  switch (k.key) {
    case 'return':
    case 'enter':
      return insert('\n')
    case 'space':
      return insert(' ')
    case 'backspace':
      return cursor === 0
        ? undefined
        : { text: text.slice(0, cursor - 1) + text.slice(cursor), cursor: cursor - 1 }
    case 'delete':
      return cursor >= text.length
        ? undefined
        : { text: text.slice(0, cursor) + text.slice(cursor + 1), cursor }
    case 'left':
      return { text, cursor: Math.max(0, cursor - 1) }
    case 'right':
      return { text, cursor: Math.min(text.length, cursor + 1) }
    case 'home': {
      const rows = layout(text, width)
      return { text, cursor: rows[rowOf(rows, cursor)]![0] }
    }
    case 'end': {
      const rows = layout(text, width)
      return { text, cursor: rows[rowOf(rows, cursor)]![1] }
    }
    case 'up':
    case 'down': {
      const rows = layout(text, width)
      const row = rowOf(rows, cursor)
      const target = rows[k.key === 'up' ? row - 1 : row + 1]
      if (!target) return { text, cursor: k.key === 'up' ? 0 : text.length }
      const column = cursor - rows[row]![0]
      return { text, cursor: Math.min(target[0] + column, target[1]) }
    }
  }
  if (IGNORED.test(k.key)) return undefined
  // A typed character, or a paste.
  return insert(k.key.replace(/\r\n?/g, '\n'))
}

const NotesEditor: ClientModule<null, State> = (_props, surface) => {
  const { Box, Text } = surface.elements
  const width = Math.max(1, surface.columns || 40)
  const height = Math.max(1, surface.rows || 5)

  if (surface.state === undefined) {
    surface.setState({ text: '', cursor: 0 })
    surface.onKey(k => {
      const now = surface.state ?? { text: '', cursor: 0 }
      const next = edit(now, k, Math.max(1, surface.columns || 40))
      if (next) surface.setState(next)
    })
  }
  const { text, cursor } = surface.state ?? { text: '', cursor: 0 }

  const rows = layout(text, width)
  const cursorRow = rowOf(rows, cursor)
  // Keep the cursor's row in view.
  const top = Math.max(0, Math.min(cursorRow - height + 1, rows.length - height))
  const visible = rows.slice(top, top + height)

  return (
    <Box flexDirection="column">
      {visible.map(([start, end], i) => {
        if (top + i !== cursorRow) return <Text>{text.slice(start, end) || ' '}</Text>
        const under = cursor < end ? text[cursor] : ' '
        return (
          <Text>
            {text.slice(start, cursor)}
            <Text inverse>{under}</Text>
            {text.slice(cursor + (cursor < end ? 1 : 0), end)}
          </Text>
        )
      })}
    </Box>
  )
}

export default NotesEditor
