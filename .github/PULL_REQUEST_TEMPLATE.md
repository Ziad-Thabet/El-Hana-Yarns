## Summary

What does this PR change, and why?

## Related issue

Closes #

## Type of change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `refactor` — no behavior change
- [ ] `docs` — documentation only
- [ ] `chore` / `perf` / `style` / `test`

## Checklist

- [ ] `npm run lint` passes with no new warnings
- [ ] `npm run build` succeeds
- [ ] No hardcoded Arabic/English strings added outside `src/lib/i18n/`
- [ ] Tailwind classes use logical (`ms-*`/`me-*`) not physical (`ml-*`/`mr-*`) forms
- [ ] No direct multi-table DB writes outside `withTransaction()`
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] `git status` checked against `.gitignore` — no `.db`, `.env`, or `userdata/` files staged

## Screenshots (if UI change)

Include both LTR and RTL screenshots if this touches a component with
bilingual layout.
