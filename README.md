# changes-notes

A Claude Code mod that adds a "Changes & notes" pane beside the chat. The top half lists the
files changed in this session, with added (`A`) or modified (`M`) and +/− line counts. The
bottom half is a plain text area for jotting things down: click it, type, and Enter adds a new
line. Nothing in the notes is saved; they last while the pane is open.

The pane opens when a session starts (docked on the right in fullscreen on a wide terminal).
Type `/notes` to open it at any width.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install changes-notes --marketplace s-d-le/claude-changes-notes
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install changes-notes --marketplace s-d-le/claude-changes-notes
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with
`s-d-le/claude-changes-notes`, then Add plugin.
