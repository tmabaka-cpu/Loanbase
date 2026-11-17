# Fxchange

Multi-tenant point-of-sale and back-office system for licensed bureaux de change in Botswana. Owner: Moneychaps (Pty) Ltd.

**The specification is `docs/blueprint.md`. Read the sections for the phase you are working on before writing code. When a rule there conflicts with a simpler implementation, keep the rule.**

## Vocabulary

- **Tenant**: one bureau de change business. **Branch**: one licensed outlet of a tenant.
- **Buy**: the bureau buys foreign currency from the customer and pays pula out. **Sell**: the reverse.
- **BWP** (pula) is the base currency. All ledger values are in BWP.
- **Void**: reversal by a contra entry. Nothing financial is ever edited or deleted.
- **Operator**: Moneychaps staff, who run the platform. Not a tenant role.

## Stack

- TypeScript throughout. One deployable web application (screens and API) with the business rules in a separate domain layer that has no dependency on the web framework.
- PostgreSQL. Versioned migrations only; never change the schema by hand.
- A background worker with a job queue for emails, reports, integrity checks and billing sync.
- Private object storage with signed, expiring links for files.

## Rules that must never be broken

1. **Tenant isolation is enforced by the database.** Every tenant-owned table has `tenant_id` and a row-level security policy. Each request sets the tenant on its database session. Never rely on an application-level filter alone.
2. **One posting service owns every financial write.** Screens, API handlers and jobs call it; they never insert into `cash_ledger`, `gl_entries`, `currency_batches`, `currency_batch_consumptions` or `currency_holdings` directly.
3. **Every posting is one database transaction** covering the document, cash ledger, stock, ledger lines and sequence number. A failure leaves nothing behind.
4. **Every posting request is idempotent.** It carries a client-generated key; the same key twice returns the first result and posts nothing.
5. **Financial tables are append-only.** The database refuses UPDATE and DELETE on ledger tables. Corrections are reversals: ledger reference `<ref>-V`, cash reference `VOID-<ref>`.
6. **Balances are running balances.** Cash per account and currency, and stock per branch and currency, are rows locked (`SELECT ... FOR UPDATE`) and updated inside the posting transaction. Never sum history to find a balance.
7. **Sequences come from a per-tenant counter row** locked inside the posting transaction. No gaps, no collisions.
8. **Money is fixed-point.** `numeric(18,2)` for amounts and quantities, `numeric(18,6)` for rates. Never floating point. Round half-up to 2 places at the point of posting.
9. **Never trust values from the client.** The server looks up the rate and recalculates the pula amount (quantity × rate applied), the branch, the till and the teller.
10. **Every ledger posting set balances.** Debits equal credits, or the posting is refused.
11. **Permissions go through one policy module.** No role checks scattered through handlers.
12. **Everything is audited.** Every create, change, approval and void writes an audit row: user, time, tenant, old and new values.

## Working method

- Build one phase at a time, in the order in section 16 of the blueprint. Do not start a phase until the previous phase's tests pass.
- For each feature: migration first, then domain rules with tests, then the API, then the screen.
- Every acceptance test in section 16 is an automated test. Run the full suite before saying work is done, and report the result honestly, including failures.
- Write a test for every numbered rule you implement. Name the test after the rule.
- User-facing error messages are plain sentences that say what is wrong and what to do, as in the blueprint.
- Do not add a dependency, a service or a pattern the blueprint does not call for without asking first.
- If the blueprint is silent or ambiguous on something that affects money, stock, tenancy or compliance, stop and ask. Do not guess.
- Secrets never go in the repository.

## Out of scope for now

Value added tax, remittances, tenant-configurable access rights, regulatory dashboards. Keep the structure open to them; do not build them.
