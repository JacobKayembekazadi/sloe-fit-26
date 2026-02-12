# Agent Continuity Playbook

> **Purpose**: Ensure seamless handoffs between AI agent sessions. Every agent reads this first.

---

## Quick Reference

| Phase | Action | File to Update |
|-------|--------|----------------|
| **START** | Read docs in order below | - |
| **WORKING** | Track progress in HANDOFF.md | `docs/HANDOFF.md` |
| **ENDING** | Write context dump before timeout | `docs/HANDOFF.md` |

---

## 1. Mandatory Startup Sequence

**Every agent session MUST begin with these reads (in order):**

```
1. CONTINUITY.md          <- You are here
2. docs/HANDOFF.md        <- Current state & last agent's notes
3. docs/LLM_CONTEXT.md    <- Full project architecture
4. docs/PRD.md            <- Product requirements
5. docs/CHANGELOG.md      <- Recent changes
```

**Do NOT start coding until you've read at least files 1-3.**

---

## 2. Context Window Management

### Warning Signs (act immediately when you notice these):
- You've been working for 15+ tool calls
- Response latency increasing
- You're losing track of earlier context
- User mentions "context" or "running out"

### Pre-Timeout Handoff Protocol

When context is running low, **STOP current work** and write a handoff:

```markdown
## Handoff Update - [YYYY-MM-DD HH:MM]

### Session Summary
- What I was working on: [task]
- Files modified: [list]
- Current status: [in-progress/blocked/complete]

### Incomplete Work
- [ ] Task 1 - why incomplete
- [ ] Task 2 - why incomplete

### Critical Context for Next Agent
- Key decisions made: [list]
- Gotchas discovered: [list]
- Next steps: [numbered list]

### Code State
- Branch: [branch name]
- Uncommitted changes: [yes/no, what]
- Tests passing: [yes/no]
```

---

## 3. Handoff File Location

All handoffs go in: `docs/HANDOFF.md`

Structure:
```markdown
# Agent Handoff Log

## Latest Handoff
[Most recent handoff here]

## Previous Handoffs
### [Date] - [Agent Type]
[Archived handoff]
```

---

## 4. Project-Specific Context

### Tech Stack Quick Reference
- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS v4
- **Backend**: Supabase (Auth, DB, RLS)
- **AI**: Google Gemini API
- **Commerce**: Shopify Buy Button

### Key Directories
```
src/
├── components/     # React components
├── pages/          # Route pages
├── lib/            # Utilities (supabase, gemini)
├── hooks/          # Custom React hooks
└── types/          # TypeScript definitions
docs/
├── HANDOFF.md      # Agent handoffs (UPDATE THIS)
├── LLM_CONTEXT.md  # Full architecture
├── PRD.md          # Product requirements
└── CHANGELOG.md    # Change history
```

### Environment Variables
Required in `.env`:
- `VITE_GEMINI_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SHOPIFY_STORE_DOMAIN`
- `VITE_SHOPIFY_STOREFRONT_ACCESS_TOKEN`

---

## 5. Agent-Specific Instructions

### Claude Code
- Uses CLAUDE.md for instructions
- Has access to MCP tools (ffmpeg, pdf, chroma, postgres)
- Prefer Edit over Write for existing files

### Gemini / Antigravity
- Uses GEMINI.md for instructions
- Has puppeteer for browser automation
- Check MCP config at `~/.gemini/antigravity/mcp_config.json`

### Cursor
- Uses .cursorrules for instructions
- Inline completions - be concise
- Tab to accept suggestions

---

## 6. Emergency Recovery

If you're a new agent with no context:

1. Read this file (CONTINUITY.md)
2. Read `docs/HANDOFF.md` for last known state
3. Run `git status` and `git log --oneline -10`
4. Read `docs/LLM_CONTEXT.md` for architecture
5. Ask user for clarification before making changes

---

## 7. Commit Message Format

```
type(scope): description

[body with context for future agents]

Co-Authored-By: [Agent Name] <noreply@[provider].com>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

---

## 8. Rules Summary

1. **READ DOCS FIRST** - No exceptions
2. **UPDATE HANDOFF.MD** - Before context runs out
3. **COMMIT OFTEN** - Small, atomic commits
4. **LEAVE BREADCRUMBS** - Future you will thank you
5. **ASK IF UNSURE** - Don't guess, clarify

---

*Last updated: 2026-02-12*
