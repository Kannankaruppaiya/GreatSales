# AGENTS.md — GreatSales CRM

> **Scope:** This file governs every agent, contributor, and automated worker touching this
> repository. It is the standing engineering contract for the project. Read it before planning,
> before writing code, and before claiming anything is done.

---

# PRODUCTION-FIRST ENGINEERING DIRECTIVE

This project is a real production application.

Every decision, architecture choice, implementation, code change, database change, API, UI,
integration, configuration, test, and deployment must be approached as production engineering.

**Do NOT treat this project as:**

- A demo
- A prototype
- A proof of concept
- A tutorial
- A sample application
- A temporary implementation
- A throwaway project
- A mock application
- A simplified exercise

Assume that real users, real data, real business operations, real security threats, real failures,
real traffic, and real operational costs will exist.

The code must be written with the expectation that it will be deployed, maintained, monitored,
scaled, tested, audited, and extended for years.

---

## PRODUCTION MEANS

### 1. Functional correctness

The implementation must satisfy the actual business requirements, business rules, workflows, edge
cases, and acceptance criteria.

Do not implement only the happy path.

### 2. User scale

Never assume that only a small number of users will use the application.

Design and evaluate the system for growth from:

1,000 users → 10,000 users → 100,000 users → 1,000,000+ users where applicable.

Consider concurrent users, request volume, traffic spikes, peak usage, background processing,
database load, and resource consumption.

### 3. Data scale

Never assume that the database will remain small.

Consider: 10K → 100K → 1M → 10M+ records where applicable.

Evaluate indexes, query performance, pagination, connection pools, locking, transactions, data
growth, archival, partitioning, and migration requirements.

### 4. Performance

Do not assume that an implementation is acceptable simply because it works.

Consider:

- Response time
- Database query time
- API latency
- Frontend rendering
- Network requests
- Memory consumption
- CPU usage
- Large payloads
- Bundle size
- Expensive operations
- N+1 queries
- Caching opportunities

Performance must be measurable.

### 5. Scalability

Every major architectural decision must be evaluated for future growth.

Ask:

- What happens when traffic increases 10x?
- What happens when traffic increases 100x?
- What becomes the first bottleneck?
- Can the service scale horizontally?
- Does the database become the bottleneck?
- Is caching required?
- Should work become asynchronous?
- Are queues required?
- Is the architecture unnecessarily stateful?

Do not prematurely over-engineer, but do not knowingly create a scaling bottleneck.

### 6. Reliability

Assume that components will fail.

Consider:

- Database failure
- API failure
- Network failure
- Third-party service failure
- Timeout
- Partial failure
- Duplicate requests
- Duplicate jobs
- Worker failure
- Deployment failure
- Infrastructure failure

Define appropriate retry, timeout, fallback, idempotency, recovery, and graceful-degradation
strategies.

### 7. Security

Assume that users may be malicious and that every externally accessible interface may be attacked.

Consider:

- Authentication
- Authorization
- RBAC
- Session security
- Input validation
- Output encoding
- SQL injection
- XSS
- CSRF
- SSRF
- IDOR/BOLA
- Privilege escalation
- Rate limiting
- Brute-force attacks
- Secrets exposure
- Sensitive data exposure
- File upload security
- Dependency vulnerabilities
- API abuse

**Never rely on frontend restrictions for security.**

### 8. Data integrity

Real production data must never be casually corrupted or lost.

Consider:

- Transactions
- Constraints
- Referential integrity
- Concurrency
- Duplicate submissions
- Idempotency
- Race conditions
- Migrations
- Backups
- Restore procedures
- Data retention
- Recovery procedures

### 9. Database engineering

Database design must be based on actual access patterns and future growth.

Consider:

- Schema design
- Relationships
- Indexes
- Constraints
- Query patterns
- Transactions
- Locks
- Connection limits
- Migration safety
- Backup and recovery
- Data growth

Do not blindly create tables based only on UI screens.

### 10. API engineering

APIs are production contracts.

Consider:

- Request validation
- Response validation
- Authentication
- Authorization
- Error contracts
- Status codes
- Pagination
- Filtering
- Sorting
- Rate limits
- Idempotency
- Versioning
- Backward compatibility
- Timeouts
- Retries
- Monitoring

Do not expose internal implementation details unnecessarily.

### 11. Frontend engineering

The frontend must be treated as production software, not visual mockup code.

Consider:

- Real API integration
- Loading states
- Error states
- Empty states
- Permission states
- Validation
- Accessibility
- Responsive behavior
- Performance
- State management
- Race conditions
- Network failures
- Offline/poor-network behavior where applicable
- Browser compatibility
- Security

### 12. Backend engineering

Backend code must enforce business rules independently of the frontend.

Consider:

- Business logic
- Validation
- Authorization
- Transactions
- Concurrency
- Error handling
- Logging
- Metrics
- Background processing
- Caching
- Queues
- Rate limiting
- Failure recovery
- Scalability

### 13. Observability

If something fails in production, engineers must be able to determine what happened.

Implement appropriate:

- Structured logging
- Error tracking
- Metrics
- Tracing
- Request IDs
- Correlation IDs
- Health checks
- Alerts
- Dashboards

Never create a production system that cannot be diagnosed.

### 14. Testing

Testing must verify more than whether the happy path works.

Consider: unit tests, integration tests, API tests, component tests, end-to-end tests, regression
tests, security tests, performance tests.

Test:

- Valid input
- Invalid input
- Boundary conditions
- Empty states
- Unauthorized access
- Concurrent requests
- Duplicate requests
- Service failures
- Database failures
- Large datasets
- High traffic

### 15. Deployment

Deployment is part of engineering, not an afterthought.

Consider:

- Environment configuration
- Secrets
- CI/CD
- Database migrations
- Deployment order
- Health checks
- Rollback
- Zero/minimal downtime
- Monitoring
- Post-deployment verification

Every risky deployment must have a recovery or rollback strategy.

### 16. Disaster recovery

Assume that serious failures can happen.

Consider:

- Backups
- Restore testing
- Recovery procedures
- Data recovery
- Service recovery
- Disaster scenarios
- Recovery Time Objective (RTO)
- Recovery Point Objective (RPO)

### 17. Maintainability

Code must be understandable and maintainable by developers who did not originally write it.

Avoid:

- Clever but unreadable code
- Unnecessary abstraction
- Hidden side effects
- Massive files
- Circular dependencies
- Duplicated business logic
- Hardcoded configuration
- Temporary hacks presented as permanent solutions

### 18. Extensibility

Do not design every feature only for today's requirements.

Consider how the system can safely evolve without requiring unnecessary rewrites.

But do not introduce abstractions without a real requirement.

### 19. Configuration

Environment-specific values must not be hardcoded.

Separate: development, testing, staging, production.

Manage secrets securely.

### 20. Third-party services

Never assume external services are permanently available.

For every external integration consider:

- Authentication
- Rate limits
- Pricing
- Timeouts
- Retries
- Failure behavior
- API changes
- Data privacy
- Vendor dependency
- Monitoring
- Fallback where necessary

### 21. Cost

Production architecture has operational cost.

Consider: compute, database, storage, bandwidth, APIs, AI model usage, token consumption,
third-party services, logging, monitoring.

Do not optimize only for technical elegance while ignoring operational cost.

### 22. AI token and context efficiency

AI-generated development must also be production-efficient.

Do not waste context on:

- Unrelated files
- Repeated information
- Huge logs
- Duplicate tool output
- Unnecessary tool definitions
- Entire repositories when only a few files are relevant
- Repeated explanations
- Unnecessary reasoning

Use:

- Targeted context retrieval
- Context budgets
- Prompt caching where supported
- Tool discovery
- Tool-result filtering
- Context compaction
- Persistent project documentation
- Task-specific context

Use the minimum context necessary to make the correct engineering decision.

**Do NOT reduce context at the expense of correctness.**

### 23. Backward compatibility

Before changing an existing API, schema, component, contract, or behavior, identify existing
consumers and dependencies.

Never assume that existing functionality can be changed freely.

### 24. Migrations

Any database, API, configuration, or architectural migration must consider:

- Existing production data
- Existing consumers
- Compatibility
- Deployment order
- Rollback
- Recovery

### 25. Auditability

Important business and security operations must be traceable where appropriate.

Consider:

- Who performed the action
- What changed
- When it changed
- Previous value
- New value
- Source/context of the action

### 26. Privacy and compliance

Treat sensitive and personal data carefully.

Consider:

- Data minimization
- Access control
- Encryption
- Retention
- Deletion
- Auditability
- Regulatory requirements applicable to the product

### 27. Accessibility

Production UI must be usable by people with different accessibility needs.

Consider:

- Keyboard navigation
- Screen readers
- Semantic HTML
- Focus management
- Contrast
- Form labels
- Error communication

### 28. Internationalization

Where applicable, do not assume:

- One language
- One currency
- One timezone
- One date format
- One number format

### 29. Failure before success

For every significant feature, think about failure scenarios before implementation.

Ask: **"What can go wrong?"**

Then define the appropriate behavior.

### 30. Change impact

Before modifying code, identify every potentially affected layer:

Frontend → State → API → Backend → Business Logic → Database → Authentication → Authorization →
Integrations → Tests → Monitoring → Deployment

Do not modify one layer blindly when the feature affects multiple layers.

### 31. No fake completion

Never claim a feature is production-ready when it contains:

- Fake APIs
- Hardcoded production behavior
- Fake authentication
- Fake authorization
- Placeholder business logic
- Unimplemented TODOs
- Silent error handling
- Temporary bypasses
- Dummy data inside production paths

If something is intentionally mocked, explicitly identify it as development-only.

### 32. AI must challenge bad requirements

Do not blindly follow instructions.

If the requested implementation is:

- Insecure
- Non-scalable
- Unmaintainable
- Unnecessarily expensive
- Architecturally inconsistent
- Likely to cause data loss
- Likely to create severe technical debt

**STOP and explain the problem before implementation.**

---

## 33. DEFINITION OF PRODUCTION-READY

A feature is production-ready only when:

| Area | Required state |
| --- | --- |
| Requirements | ✓ Complete |
| Business logic | ✓ Correct |
| Frontend | ✓ Complete |
| Backend | ✓ Complete |
| Database | ✓ Safe |
| API | ✓ Validated and secured |
| Authentication | ✓ Correct |
| Authorization | ✓ Enforced server-side |
| Error handling | ✓ Implemented |
| Edge cases | ✓ Considered |
| Security | ✓ Reviewed |
| Performance | ✓ Evaluated |
| Scalability | ✓ Evaluated |
| Testing | ✓ Completed appropriately |
| Observability | ✓ Available where required |
| Deployment | ✓ Safe |
| Rollback / recovery | ✓ Considered |
| Documentation | ✓ Updated |
| Maintainability | ✓ Acceptable |
| No known critical production blocker | ✓ Confirmed |

---

## FINAL DIRECTIVE

Do not ask:

> "How can I make this feature work?"

Think:

> "How do I implement this feature so that it remains correct, secure, observable, maintainable,
> testable, performant, scalable, recoverable, and operationally safe when real users, real data,
> real traffic, real failures, and future changes occur?"

The goal is not to generate code quickly.

**The goal is to generate production-quality software correctly.**
