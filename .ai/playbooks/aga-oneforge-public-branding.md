# AGA OneForge Public Branding

Last tested: 2026-07-11
Routes: ERP `/login`, MES `/login`, Academy `/`, docs `/`

## Prerequisites

- Link the checkout's ignored app `.env` and `.env.local` files to an existing local dev environment.
- Start ERP, MES, Academy, and docs on separate ports.

## Steps

### 1. Navigate

Open the four public routes and wait for network idle.

### 2. Verify desktop

At 1440x900, confirm each title contains AGA OneForge, visible page text contains AGA OneForge, every loaded image has a non-zero natural width, and `scrollWidth` does not exceed `clientWidth`.

### 3. Verify mobile

Repeat at 375x812. The ERP and MES mobile layouts must show the text wordmark above the login form, and the Academy hero actions must wrap.

## Selector Notes

- These checks need no interactive refs; inspect `document.title`, `document.body.innerText`, `document.images`, and document-element widths.

## Common Failures

- A fresh worktree without app-level environment files renders Vite's environment validation error instead of the public route.
- Fixed 380px login content overflows a 375px viewport; use a full-width element capped at 380px.
