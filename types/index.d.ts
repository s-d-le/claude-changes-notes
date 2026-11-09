export type FileChange = { path: string; added: number; removed: number; isNew: boolean }

declare module 'claude-code' {
  interface PluginState {
    'changes-notes': { changes: Shaped<FileChange[]> }
  }
}
