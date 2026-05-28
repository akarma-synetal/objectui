# ObjectUI Copilot Skill

A single, tree-based Copilot skill consolidating all ObjectUI development knowledge, aligned with [shadcn/ui's skill structure](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn).

## Layout

```
skills/objectui/
├── SKILL.md      # Main entry — core principles, tech stack, package map, JSON protocol
├── rules/        # Non-negotiable global constraints
│   ├── protocol.md
│   ├── styling.md
│   ├── composition.md
│   └── no-touch-zones.md
├── guides/       # Domain-specific deep dives
│   ├── page-builder.md
│   ├── plugin-development.md
│   ├── schema-expressions.md
│   ├── data-integration.md
│   ├── project-setup.md
│   ├── testing.md
│   ├── i18n.md
│   ├── mobile.md
│   ├── auth-permissions.md
│   └── console-development.md
└── evals/        # Evaluation prompts (one per guide)
```

For the full table of contents (rules + guides links), see the **Quick Reference** section in `SKILL.md`.

## Eval format

Each `evals/<topic>.json` follows the same shape so the prompts can be run as machine-checkable regression tests:

```jsonc
{
  "skill_name": "objectui",
  "evals": [
    {
      "id": 1,
      "prompt": "End-user style request that should trigger this skill.",
      "expected_output": "Plain-English summary of what a correct answer covers.",
      "files": [],
      "assertions": {
        "must_contain":     ["HighSignalSymbol", "@object-ui/...", "..."],
        "must_not_contain": ["AntiPatternSnippet", "..."]
      }
    }
  ]
}
```

- `assertions.must_contain` — case-sensitive substrings the answer **must** mention (API names, hook names, file names). Pass requires ALL.
- `assertions.must_not_contain` — anti-patterns. Any hit fails the eval. Use it to guard against React-only answers when the question wants a schema, or against bypasses of the DataSource interface.
- Keep lists short and high-signal (3–6 entries). Prefer unique tokens (`SchemaRendererProvider`, `useDataScope`) over generic words (`component`, `data`).

## How the agent uses it

1. Reads `SKILL.md` for core principles and architecture orientation.
2. Loads the relevant `rules/*.md` to ensure non-negotiables are respected.
3. Pulls one or more `guides/*.md` matching the task.

## Coverage map

The skill stays in sync with the `packages/` tree:

- **Core renderer:** `@object-ui/types`, `core`, `components`, `fields`, `layout`, `react`
- **Integration:** `@object-ui/app-shell`, `providers`, `runner`, `data-objectstack`
- **Platform features:** `@object-ui/auth`, `permissions`, `tenant`, `i18n`, `mobile`, `collaboration`
- **Plugins (19):** `plugin-{grid, list, detail, form, kanban, calendar, timeline, gantt, dashboard, report, charts, map, editor, markdown, view, designer, workflow, ai, chatbot}`
- **Tooling:** `@object-ui/cli`, `create-plugin`, `vscode-extension`

## Maintenance

When adding new content:

- **Core principles / architecture / package map change** → update `SKILL.md`.
- **New non-negotiable constraint** → add a file under `rules/`.
- **New domain area** → add a guide under `guides/` *and* an eval JSON under `evals/` with the same basename.
- **Removing or renaming a guide** → rename the matching `evals/<name>.json` in the same change.

All authored text — including eval prompts and expected outputs — must be **English-only** (see `SKILL.md` Core Principle 0).

## Reference

- shadcn/ui skill structure: https://github.com/shadcn-ui/ui/tree/main/skills/shadcn
- ObjectUI repository: https://github.com/objectstack-ai/objectui
