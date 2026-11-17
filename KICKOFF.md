# Fxchange rebuild: how to start with Claude Code

## 1. Set up the repository

1. Create an empty repository named `fxchange`.
2. Add the two files from this pack:
   - `CLAUDE.md` in the repository root
   - `blueprint.md` as `docs/blueprint.md`
3. Open the repository in Claude Code.

Claude Code reads `CLAUDE.md` automatically at the start of every session, so the rules in it apply to all work.

## 2. Before Phase 0: settle the open items

| Item | Who | Needed before |
| --- | --- | --- |
| Hosting region confirmed by a Botswana data protection lawyer | Thabiso | Phase 0 deployment |
| Cloud provider chosen (one of the South Africa regions) | Thabiso | Phase 0 deployment |
| Zoho Billing trial: invoices in pula, usable payment gateway | Thabiso | Phase 1 billing sync |
| Plan prices in pula | Thabiso | Launch |

Phases 0 to 5 can be built and tested locally before any of these is settled.

## 3. Prompts, one per phase

Paste one prompt per session. Start a new session for each phase.

### Phase 0: Foundation

```
Read CLAUDE.md and docs/blueprint.md sections 1, 3, 6, 13 and 16.

Set up the foundation for Fxchange (Phase 0 in section 16):
- The project structure: web application, domain layer, worker, with the domain layer free of web-framework dependencies.
- PostgreSQL with a migration tool, and a local development database in Docker.
- The test setup, including a way to run tests against a real PostgreSQL database.
- The audit log table and a helper to write to it.
- Continuous integration that runs lint, type-check and tests on every push.
- A README with the commands to install, migrate, test and run.

Before writing code, propose the stack choices (framework, ORM or query builder, test runner, job queue, auth library) with one line of reasoning each, and wait for my approval.
```

### Phase 1: Tenancy and access

```
Read CLAUDE.md and docs/blueprint.md sections 4, 5, 6 and the Phase 1 acceptance tests in section 16.

Build Phase 1:
- Tables for tenants, branches, staff, compliance access grants and the shared masters, with row-level security on every tenant-owned table.
- Sign-in, and the request pipeline that sets the tenant on the database session.
- The policy module holding every rule in section 4.
- Subscription and branch status checks exactly as in section 5: blocked means no new entries, but viewing and export still work.
- Branch limit and staff seat limit.
- The operator console: create a tenant, set its plan, limits and status.
- The onboarding action in section 5, safe to run twice.

Work in this order: migrations, domain rules with tests, API, screens. Write each "Tenancy and access" acceptance test in section 16 as an automated test. Finish by running the whole suite and showing me the output.
```

### Phase 2: Posting core

```
Read CLAUDE.md and docs/blueprint.md sections 8 (cash accounts, cash ledger), 10 (posting rules) and 13 (design rules).

Build Phase 2, the posting core:
- Cash accounts with the four types and their rules.
- The cash ledger with running balances and the cash floor check.
- The general ledger: post a balanced set of lines, and reverse a posted set under <ref>-V.
- Per-tenant sequences.
- Idempotent posting requests.
- Database-level protection that refuses UPDATE and DELETE on the ledger tables.

Write each "Posting core" acceptance test in section 16, including a concurrency test with two simultaneous postings. Show me the posting service code for review before moving on.
```

### Phase 3: Trading

```
Read CLAUDE.md and docs/blueprint.md sections 7, 8, 9 and 11, and the "Trading", "Tills and cash" and "Decisions" acceptance tests in section 16.

Build Phase 3 on top of the posting core: tenant currencies, exchange rates, customers, till sessions, cash transfers (including two-step branch transfers with stock in transit), transactions with approvals and voids, non-cash settlement accounts, stock costing by the tenant's one valuation method, trading posted to the general ledger, and the printable receipt.

Build and test in this order: rates, customers, till sessions and transfers, stock costing, transactions, voids, receipt. After each, run the suite.
```

### Phase 4: Accounts

```
Read CLAUDE.md and docs/blueprint.md section 10 in full and the "Accounts" acceptance tests in section 16.

Build Phase 4: chart of accounts with the seeded accounts, suppliers, bills, payments and receipts, journals, loans, opening balances, the opening trial balance with suspense, month-end close and year-end close.

The last acceptance test is that the trial balance balances after every other test. Add that as a check that runs at the end of the whole suite.
```

### Phase 5: Reports

```
Read CLAUDE.md and docs/blueprint.md section 12 and the "Reports" acceptance tests in section 16.

Build Phase 5: End of Day report with saved sign-off, Income and Expense Summary, Bank of Botswana Form 5 for a branch and month, trial balance, balance sheet, general ledger detail, supplier statement, stock valuation, and export of each to PDF and Excel.

For Form 5, build a fixture month with known transactions across all three parts, both schedules, cash and non-cash modes, and rand, and assert every cell against hand-calculated figures.
```

### Phases 6 and 7

Compliance (section 11) and offline (section 14) follow the same pattern: name the sections, name the acceptance tests, ask for migrations and rules with tests first.

## 4. Starting the pilot

The pilot with real users starts after Phase 5, on this platform. There is no data migration from Zoho Creator. Work through the pilot readiness checklist in section 15 of the blueprint before the first tenant trades.

## 5. What to review yourself

- **The posting service**, line by line. This is where an accountant's eye matters most.
- **Every migration** that touches a financial table.
- **The Form 5 test fixture** against a return you have prepared by hand.
- **The test output** at the end of each phase. Do not accept "done" without it.
