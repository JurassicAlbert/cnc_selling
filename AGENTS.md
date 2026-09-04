<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` - verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Imported Claude Cowork project instructions

==================================================
TEST-DRIVEN DEVELOPMENT (TDD)
==================================================

Use Test-Driven Development as the default approach for all business-critical functionality.

Before implementing a new functional feature:

1. Define the expected behavior.
2. Identify normal cases.
3. Identify edge cases and invalid cases.
4. Write the tests/specifications first.
5. Use mocks/stubs for external dependencies where necessary.
6. Run the tests and confirm that they fail for the expected reason.
7. Implement the minimum functionality required to make the tests pass.
8. Refactor while keeping all tests passing.
9. Add additional tests for bugs discovered during implementation.
10. Only then consider the functionality complete.

Do NOT write tests merely to achieve high code coverage.

Tests must verify actual business behavior.

==================================================
CRITICAL FUNCTIONALITY REQUIRES TESTS FIRST
==================================================

The following functionality MUST have tests written before implementation:

- product configuration
- product/material compatibility
- dimensions and dimension limits
- production constraints
- pricing calculations
- discounts
- modular product calculations
- personalization validation
- file upload validation
- file type and size restrictions
- customer design workflow
- IP/copyright confirmation
- cart calculations
- order totals
- configuration persistence
- order configuration snapshots
- customer authorization
- access to uploaded files
- authentication/authorization
- API validation
- error handling
- checkout/order creation
- production status transitions

For each feature, tests should cover:

- valid input
- invalid input
- boundary values
- incompatible combinations
- missing data
- unexpected input
- failure states
- authorization failures where applicable

==================================================
MOCKS AND EXTERNAL SERVICES
==================================================

When an external service is not available during development:

- create an appropriate interface/abstraction
- create mocks or test doubles
- test the application's behavior against those mocks
- do NOT replace the real functionality with fake production behavior

Examples:

Payment provider:
→ mock payment provider in tests
→ test success, failure, cancellation and timeout
→ integrate the real provider separately

File storage:
→ mock storage in unit tests
→ test upload, retrieval, authorization and deletion
→ use real storage in integration testing where appropriate

Email:
→ mock email service
→ verify that the correct notification would be sent
→ do not pretend that an email was actually delivered

==================================================
NO FAKE FUNCTIONALITY
==================================================

Never create fake functionality that gives the user the impression that a real operation has happened.

Do NOT create:

- fake checkout
- fake payment confirmation
- fake successful orders
- fake file processing
- fake CNC toolpaths
- fake production files
- fake laser files
- fake production status updates
- fake inventory confirmation
- fake email delivery
- fake shipping confirmation

If an external integration is not implemented yet, clearly mark it as incomplete or use a development-only test/mock environment that cannot be mistaken for production.

A mock is acceptable inside tests.

A fake production workflow presented to the customer is NOT acceptable.

==================================================
TEST PYRAMID
==================================================

Use an appropriate mix of:

- unit tests for business logic
- integration tests for database/API behavior
- component tests for important UI behavior
- end-to-end tests for critical customer journeys

Prioritize tests around business-critical functionality rather than testing every trivial UI detail.

==================================================
CRITICAL END-TO-END FLOWS
==================================================

At minimum, create end-to-end tests for:

1. Customer selects a product
→ chooses design
→ chooses material
→ chooses dimensions
→ adds personalization
→ sees updated price
→ adds to cart.

2. Customer uploads a custom design
→ file is validated
→ configuration is saved
→ project enters the correct review status.

3. Customer configures a kitchen tile
→ selects one of the three installation concepts
→ selects design/material
→ sees the correct configuration and price.

4. Customer configures a large modular product
→ dimensions exceed the machine's working area
→ system calculates the appropriate module structure
→ configuration remains consistent.

5. Customer completes an order
→ final price is recalculated server-side
→ order is created
→ complete configuration snapshot is stored.

6. Unauthorized customer attempts to access another customer's uploaded design/order
→ access is denied.

==================================================
REGRESSION TESTING
==================================================

Whenever a bug is discovered:

1. Reproduce it.
2. Write a regression test that fails because of the bug.
3. Fix the bug.
4. Confirm the regression test passes.
5. Run the relevant test suite.

Never fix a recurring business-logic bug without adding a regression test.

==================================================
DEFINITION OF DONE
==================================================

A functional feature is NOT considered complete until:

[ ] requirements are clearly defined
[ ] normal cases are tested
[ ] edge cases are tested
[ ] invalid cases are tested
[ ] failure states are tested
[ ] authorization/security cases are tested where relevant
[ ] implementation passes all tests
[ ] integration behavior is verified
[ ] critical user flow is tested
[ ] no fake production behavior is being presented as real
[ ] documentation is updated where necessary

The goal is not maximum test coverage.

The goal is to make it difficult for missing requirements, edge cases or regressions to reach production.
