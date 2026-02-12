# Claude Code Project Instructions

> **STOP**: Before doing anything, complete the startup checklist below.

---

## Mandatory Startup Checklist

```
[ ] 1. Read CONTINUITY.md (agent playbook)
[ ] 2. Read docs/HANDOFF.md (last agent's state)
[ ] 3. Read docs/LLM_CONTEXT.md (architecture)
[ ] 4. Run: git status && git log --oneline -5
[ ] 5. THEN start working
```

**Do NOT skip these steps. Do NOT start coding before reading docs.**

---

## Context Window Management

### CRITICAL: Handoff Before Timeout

When you notice ANY of these warning signs:
- 15+ tool calls in session
- Slower response times
- Losing track of earlier context
- User mentions context concerns

**IMMEDIATELY stop and write a handoff to `docs/HANDOFF.md`:**

```markdown
## Handoff Update - [YYYY-MM-DD HH:MM]

### Session Summary
- Working on: [task]
- Files modified: [list]
- Status: [in-progress/blocked/complete]

### Incomplete Work
- [ ] Task - reason incomplete

### Critical Context
- Decisions made: [list]
- Gotchas: [list]
- Next steps: [list]
```

---

## Project Rules

### Code Style
- TypeScript strict mode
- Functional React components with hooks
- Tailwind CSS v4 for styling
- Small, focused commits

### File Operations
- **ALWAYS** read a file before editing it
- Prefer `Edit` over `Write` for existing files
- Check `git status` before committing

### Testing
- Run `npm run build` before committing
- Check for TypeScript errors
- Test in browser when possible

### Commits
```
type(scope): description

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## MCP Tools Available

- **ffmpeg**: Video processing
- **pdf**: PDF reading
- **chroma**: Vector database
- **postgres**: SQL queries
- **remotion**: Video creation

---

## Key Files

| File | Purpose |
|------|---------|
| `CONTINUITY.md` | Agent playbook (read first) |
| `docs/HANDOFF.md` | Session handoffs (update before timeout) |
| `docs/LLM_CONTEXT.md` | Full architecture context |
| `docs/PRD.md` | Product requirements |
| `docs/CHANGELOG.md` | Change history |

---

## Environment

Required `.env` variables:
- `VITE_GEMINI_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SHOPIFY_STORE_DOMAIN`
- `VITE_SHOPIFY_STOREFRONT_ACCESS_TOKEN`

---

## Emergency: Lost Context?

1. Read `CONTINUITY.md`
2. Read `docs/HANDOFF.md`
3. Run `git status` and `git log --oneline -10`
4. Read `docs/LLM_CONTEXT.md`
5. Ask user for clarification

---

*These instructions override default behavior. Follow them exactly.*
