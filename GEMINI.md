# Gemini Agent Instructions

> **STOP**: Before doing anything, complete the startup checklist below.

---

## Mandatory Startup Checklist

```
[ ] 1. Read CONTINUITY.md (agent playbook)
[ ] 2. Read docs/HANDOFF.md (last agent's state)
[ ] 3. Read docs/LLM_CONTEXT.md (architecture)
[ ] 4. Check git status and recent commits
[ ] 5. THEN start working
```

**Do NOT skip these steps. Do NOT start coding before reading docs.**

---

## Context Window Management

### CRITICAL: Handoff Before Timeout

When you notice ANY of these warning signs:
- Extended conversation length
- Complex multi-step operations
- User mentions context concerns
- You're losing track of earlier work

**IMMEDIATELY stop and write a handoff to `docs/HANDOFF.md`:**

```markdown
## Handoff Update - [YYYY-MM-DD HH:MM] - Gemini

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
- Check existing patterns before adding new code
- Verify changes don't break existing functionality

### Testing
- Build before committing: `npm run build`
- Check for TypeScript errors
- Test in browser when possible

### Commits
```
type(scope): description

Co-Authored-By: Gemini <noreply@google.com>
```

---

## MCP Tools Available (Antigravity)

Check `~/.gemini/antigravity/mcp_config.json` for:
- **github**: GitHub API access
- **filesystem**: File operations
- **fetch**: HTTP requests
- **memory**: Persistent memory
- **puppeteer**: Browser automation
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

## Tech Stack Quick Reference

- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS v4
- **Backend**: Supabase (Auth, DB, RLS)
- **AI**: Google Gemini API
- **Commerce**: Shopify Buy Button

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
3. Check `git status` and `git log --oneline -10`
4. Read `docs/LLM_CONTEXT.md`
5. Ask user for clarification

---

*These instructions are mandatory. Follow them exactly.*
