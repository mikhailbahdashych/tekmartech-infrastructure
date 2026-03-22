# Tekmar — Architecture Contract

**Version:** 1.0
**Status:** Ratified
**Last updated:** 2026-03-19

---

## 1. What Tekmar Is

Tekmar is an AI-powered infrastructure query and analysis engine for security and compliance teams. It translates natural language questions about an organization's technical environment into executed, verified queries across connected systems, and returns structured, exportable results.

Tekmar is not a GRC platform. It does not manage compliance frameworks, track controls, store policies, generate trust reports, or replace tools like Vanta, Drata, or Secureframe. It complements them by solving the problem they leave untouched: dynamically answering arbitrary questions about infrastructure state, whether those questions come from an auditor during a certification review, a CISO requesting a security posture summary, or a security engineer performing a routine access review.

The product serves three use cases that collectively justify year-round subscription value. The first is daily security operations: answering ad-hoc questions about infrastructure state, access configurations, vulnerability status, and security posture. The second is recurring compliance operations: scheduled, repeatable queries that map to specific compliance controls, such as quarterly access reviews, monthly vulnerability summaries, and onboarding verification workflows. The third is audit evidence generation: producing structured, verifiable evidence packages in response to specific auditor requests.

These three use cases are not separate products. They are one engine, one interface, one capability applied to different contexts. The underlying technology is identical: natural language input, AI-powered interpretation, MCP-based tool orchestration, deterministic execution, and structured output.

---

## 2. Tenancy Model

Tekmar is a multi-tenant system. Each tenant is an **organization**. All data within the system is scoped to an organization. No user, query, integration, credential, file, or log entry exists outside the context of an organization.

An organization is created by a founding user who becomes its first administrator. Additional users are invited into the organization by existing administrators. Every user belongs to exactly one organization. There is no multi-organization membership.

Data isolation between organizations is absolute. No API endpoint, no database query, no background process, and no administrative function may expose data from one organization to users of another organization. This isolation is enforced at the data access layer within every service that connects to the database, not at the application logic layer. Every database query includes an organization scope filter as a structural guarantee.

---

## 3. User Model

The system recognizes two classes of users that are fundamentally distinct in their purpose, their authentication mechanisms, and their access scope.

### 3.1 Customer Users

Customer users are employees of organizations that use Tekmar as a product. They authenticate through the public-facing Application API, they belong to exactly one organization, and they can only see and interact with data belonging to their organization.

Customer users have one of two roles within their organization:

**Admin** — can manage integrations (connect, disconnect, configure credentials), manage team membership (invite users, remove users, change roles), manage billing and subscription settings, configure organization-level settings (data retention policies, notification preferences), and run queries.

**Member** — can run queries, view their own query history, and access shared query results. Members cannot modify integrations, team membership, billing, or organization settings.

This is the initial role model. The data model is designed to support additional roles without structural changes by extending the role definition rather than restructuring the authorization system.

### 3.2 Internal Operators

Internal operators are Tekmar employees who access the system through the Admin API, which is deployed on an internal network accessible only via VPN. Internal operators authenticate through a separate mechanism from customer users.

Internal operators have cross-organization visibility. They can view all organizations, all users, all queries, all integrations, all system health metrics, and all audit logs. They can perform administrative actions such as enabling or disabling features for specific organizations, blocking users, resetting passwords upon helpdesk request, and managing subscription states.

Internal operator accounts are stored in the same database as customer user accounts but are distinguished by a user class field that separates the two populations at the data model level.

---

## 4. System Components

The system consists of seven independently developed and independently deployed components, each housed in its own repository.

### 4.1 tekmar-interface

The customer-facing web application. Built with Angular. Deployed on the public internet. This is the surface through which customer users interact with the product: submitting queries, reviewing query plans, viewing results, managing their account, and configuring organization settings (for admins).

The Interface Layer communicates exclusively with the Application API. It never communicates directly with the Pipeline Service, the MCP servers, the database, or any external system. All data flows through the Application API.

### 4.2 tekmar-api

The Application API. Built with NestJS and TypeScript. Deployed on the public internet. This is the central gateway for all customer-facing functionality.

The Application API has the following responsibilities:

It handles user authentication and session management for customer users, including registration, login, invitation acceptance, and password management.

It manages organization lifecycle: creation, settings, subscription, and membership.

It manages integration credentials: storing encrypted credentials, testing connection health, and providing credential context to the Pipeline Service when queries are submitted.

It acts as the gateway between the Interface Layer and the Pipeline Service. When a user submits a query, the Application API validates the request, enriches it with the user's integration credentials and organizational context, and forwards it to the Pipeline Service. When the Pipeline Service returns a query plan for approval or final results, they flow back through the Application API to the Interface Layer.

It manages all persistent data: query history, saved queries, file exports, audit logs, and notification preferences. It is one of two services (alongside the Admin API) that access the database directly.

It hosts two subsystems that operate as logically isolated modules within the service: the scheduled query executor (which triggers saved queries on configured schedules and submits them to the Pipeline Service) and the notification dispatcher (which delivers notifications through configured channels when queries complete, fail, or produce findings that meet alert criteria).

It supports both session-based authentication (for the Interface Layer) and API key authentication (for programmatic access by customer scripts and CI/CD pipelines). API key authentication is declared architecturally and will be implemented after the initial product launch.

### 4.3 tekmar-pipeline

The Pipeline Service. Built with Python and FastAPI. Deployed on an internal network, not exposed to the public internet. Accessible only by the Application API through the internal API.

The Pipeline Service handles the complete lifecycle of a query from the moment it receives a request from the Application API to the moment it returns formatted results. It contains four internal modules:

**The Orchestrator** coordinates the step-by-step execution of a query. It receives a query request, sends it to the Interpreter, receives the query plan, returns the plan to the Application API for user approval (or proceeds directly if the user has enabled auto-execution), sends the approved plan to the Execution Engine, collects results, passes them to the Output Engine, and returns the formatted output to the Application API. The Orchestrator handles error states within the query lifecycle: retries, timeouts, partial failures, and graceful degradation.

**The Interpreter** is the AI-powered component that translates natural language input into structured query plans. It receives the user's question along with a catalog of available MCP tools (determined by which integrations the organization has connected), and it produces a query plan: a structured document describing a sequence of discrete steps, where each step specifies which MCP tool to invoke, what parameters to pass, and what to do with the result. The Interpreter can only reference MCP tools that exist in the provided catalog. It cannot invent tools, construct raw API calls, or generate arbitrary code. If a request cannot be fulfilled with available tools, the Interpreter reports this in the plan. The Interpreter has access to a library of verified query plan templates for common requests. When a user's question matches a known pattern, the Interpreter uses the template rather than constructing a plan from scratch, which increases determinism and reliability. The Interpreter communicates with an LLM provider through an abstraction layer that allows the provider to be swapped (between commercial APIs such as Claude or GPT, and local models through Ollama) without architectural changes.

**The Execution Engine** takes an approved query plan and executes it deterministically. There is no AI in this component. It reads the plan step by step, invokes the specified MCP tools with the specified parameters, collects results, applies transformations (filtering, sorting, joining across steps), and produces raw output along with a complete transparency log recording every MCP tool call, its parameters, timestamps, response status, and response data hashes. The Execution Engine communicates with external systems exclusively through MCP servers in the Integration Layer.

**The Output Engine** formats raw query results into the structure the user needs: human-readable summaries for display in the Interface, downloadable evidence packages (CSV, and other formats added over time), and the formatted transparency log. The Output Engine may use AI for contextual interpretation of results (highlighting proportions, flagging results against compliance thresholds), but it operates on verified data produced by the Execution Engine.

The Pipeline Service is stateless. It does not access the database. It does not know about users, organizations, sessions, or authentication. Every request it receives from the Application API is self-contained: it includes the query text, the available MCP tool catalog, and the credentials needed to invoke those tools. From the Pipeline Service's perspective, every request is anonymous. This statelessness means the Pipeline Service can be restarted, scaled, or replaced without affecting any other component.

The Pipeline Service never persists credentials. Credentials exist in the Pipeline Service's memory only for the duration of a query execution and are discarded when the query completes.

### 4.4 tekmar-integrations

The Integration Layer. A collection of MCP servers, one per supported external system. Built with Python using the MCP Python SDK. Each MCP server runs as a lightweight process communicating with the Pipeline Service via the MCP protocol.

Each MCP server exposes a set of tools that the Execution Engine can invoke. For example, the AWS MCP server exposes tools for querying IAM users, CloudTrail events, S3 bucket configurations, security group rules, and other AWS resources. The Google Workspace MCP server exposes tools for querying user directories, MFA enrollment status, application assignments, and authentication logs.

Each MCP server contains the actual integration code for its external service (boto3 for AWS, Google API client libraries for Google Workspace, and so on). The MCP layer wraps these API calls in a standardized interface so that the Execution Engine interacts with all integrations identically.

Three properties are non-negotiable for every MCP server:

**Read-only access.** The product never modifies, creates, or deletes anything in a customer's infrastructure. Every MCP tool performs read operations only.

**Self-documenting tools.** Each tool declares its inputs, outputs, and behavior in a machine-readable format, so that the Interpreter knows precisely what each tool can do when constructing query plans.

**Input validation.** Each tool validates its parameters and rejects malformed, out-of-range, or potentially dangerous inputs regardless of what the query plan specifies.

MCP servers are organized within a single repository, with each server in its own directory. They share common utilities (credential handling, error formatting, rate limit management) but are otherwise independent. Adding support for a new external system means adding a new MCP server directory. It does not require changes to the Pipeline Service, the Application API, or any other component.

### 4.5 tekmar-admin

The internal admin frontend. Built with Angular. Deployed on an internal network accessible only via VPN. This is the interface through which Tekmar employees manage the platform: viewing all organizations, monitoring system health, managing customer accounts, toggling features, and performing support operations.

The Admin Frontend communicates exclusively with the Admin API. It never communicates with the Application API, the Pipeline Service, or any other component.

### 4.6 tekmar-admin-api

The Admin API. Built with NestJS and TypeScript. Deployed on an internal network accessible only via VPN. Never exposed to the public internet. There is no public DNS record for this service.

The Admin API connects to the same PostgreSQL database as the Application API. They share the same schema and the same tables. There is no data synchronization between them because there is only one database.

Database migrations are managed by the Application API. The Admin API consumes the resulting schema but does not run its own migrations. This ensures a single source of truth for schema evolution.

The Admin API provides cross-organization access for internal operators: listing all organizations, viewing any organization's data, managing user accounts across organizations, toggling feature flags, viewing system-wide metrics and audit logs, and performing support actions (password resets, account unlocks, subscription adjustments).

The Admin API has no admin endpoints that overlap with the Application API's customer endpoints. They are entirely separate API surfaces serving entirely separate audiences through entirely separate network paths.

### 4.7 tekmar-infrastructure

The infrastructure and deployment configuration repository. Contains Docker Compose files, environment configuration templates, contract definitions, and deployment documentation.

This repository houses the `contracts/` directory, which is the single source of truth for all interface definitions governing component communication.

---

## 5. Boundaries and Contracts

A boundary exists wherever two independently deployed components communicate through a defined interface. Five boundaries exist in the system, each governed by a dedicated contract specification.

**Boundary 1 — Public API** (`public-api.yaml`): Defines all HTTP endpoints and WebSocket message types between the Interface Layer (`tekmar-interface`) and the Application API (`tekmar-api`). This includes authentication endpoints, organization management, integration management, query submission and result delivery, query history, saved queries, notification preferences, and file export downloads.

**Boundary 2 — Internal API** (`internal-api.yaml`): Defines all HTTP endpoints between the Application API (`tekmar-api`) and the Pipeline Service (`tekmar-pipeline`). This includes query request submission, query plan delivery for approval, approval confirmation, result delivery, and error reporting. This boundary is internal: it is never exposed to the public internet.

**Boundary 3 — MCP Tool Interface** (`mcp-tool-interface.yaml`): Defines the schema for how MCP tools declare their capabilities (the tool catalog), how the Execution Engine invokes tools (invocation format and parameters), and how tools return results (response format and error handling). This boundary governs communication between the Pipeline Service (`tekmar-pipeline`) and all MCP servers in the Integration Layer (`tekmar-integrations`).

**Boundary 4 — Data Model** (`data-model.yaml`): Defines every database table, column, type, constraint, and relationship in the shared PostgreSQL database. Both the Application API (`tekmar-api`) and the Admin API (`tekmar-admin-api`) connect to this database. The schema is the contract that both services must conform to.

**Boundary 5 — Admin API** (`admin-api.yaml`): Defines all HTTP endpoints between the Admin Frontend (`tekmar-admin`) and the Admin API (`tekmar-admin-api`). This includes internal operator authentication, organization listing and inspection, user management, feature flag management, system metrics, and support operations.

An additional document, the Architecture Contract (`architecture.md` — this document), describes the system structure, component responsibilities, and architectural invariants that all components must respect. It is not a boundary specification but the foundational context referenced by every component's development instructions.

---

## 6. Credential Management

Integration credentials (AWS access keys, Google OAuth tokens, GitHub tokens, and similar) are sensitive assets that require specific handling throughout the system.

### 6.1 Storage

Credentials are stored in PostgreSQL by the Application API, encrypted at rest. They are scoped to the organization that owns the integration. Only administrators within an organization can create, modify, or delete integration credentials. The encryption key management approach is defined at the implementation level, not at the architectural level.

### 6.2 Transit

Credentials must travel from the Application API to the Pipeline Service with every query request, because the Pipeline Service needs them to invoke MCP tools against the customer's external systems. The system uses a dual-mode transit model:

**Broker mode** (preferred): For external services that support temporary credential generation (such as AWS STS), the Application API generates short-lived, scoped temporary credentials from the stored long-lived credentials and sends only the temporary credentials to the Pipeline Service. This minimizes the blast radius if the Pipeline Service is compromised.

**Direct transit mode** (fallback): For external services that do not support temporary credential generation (such as GitHub Personal Access Tokens), the Application API decrypts the stored credentials and sends them directly to the Pipeline Service as part of the query request payload.

In both modes, the following invariant holds: **the Pipeline Service never persists credentials.** Credentials exist in the Pipeline Service's memory only for the duration of a query execution and are discarded immediately upon completion. The Pipeline Service has no credential store, no credential cache, and no mechanism to write credentials to disk or database.

### 6.3 MCP Server Credential Handling

MCP servers receive credentials from the Execution Engine as part of each tool invocation. They use the credentials to authenticate with the external service's API, execute the read-only query, and return the result. MCP servers do not cache, log, or persist credentials.

---

## 7. File Storage and Export

When the Output Engine produces a downloadable evidence package (CSV, or other formats added over time), the file follows this path:

The Pipeline Service generates the file content in memory and passes it back to the Application API as part of the query result payload. The Application API stores the file in an object storage location. In the initial deployment, this is a local filesystem or a cloud object storage service (such as AWS S3). The Application API generates a signed, time-limited URL for the file and provides it to the Interface Layer for download.

Files are organization-scoped. A file generated from one organization's query is never accessible to another organization. Files are subject to the organization's data retention policy and are automatically removed when the retention period expires.

The Application API is the only component that manages file storage and access control. The Pipeline Service generates file content but never stores it. The Interface Layer downloads files through the Application API but never accesses storage directly.

---

## 8. Audit Logging

The system maintains two distinct categories of logs.

### 8.1 Transparency Logs

Transparency logs record everything that happens during the execution of a query: every MCP tool call, its parameters, its timestamp, its response status, its response time, and a hash of the returned data. These logs are produced by the Execution Engine within the Pipeline Service and are returned to the Application API as part of the query result. They are stored in the database, scoped to the organization, and serve as verifiable proof of how a query result was produced. Users can review transparency logs to independently verify that the output matches the actual data returned from their systems.

### 8.2 Activity Logs

Activity logs record significant actions performed within the platform by users and internal operators: who connected an integration, who ran which query, who invited which user, who changed which settings, who modified billing, who accessed which organization's data (for internal operators). Activity logs are produced by the Application API and the Admin API at the point where each action is performed. They are stored in the database, scoped to the organization for customer actions and system-wide for internal operator actions.

Activity logs serve both compliance and operational purposes. Customers can review their organization's activity log to maintain an internal audit trail of who did what in the platform. Internal operators can review system-wide activity logs for support, debugging, and security monitoring.

---

## 9. Scheduled Queries and Notifications

### 9.1 Scheduled Query Execution

The scheduled query executor is a subsystem within the Application API. It runs as a background module within the Application API process.

At configured intervals, it reads saved query definitions and their schedules from the database, assembles the required credential context, and submits query requests to the Pipeline Service through the same internal API used for user-initiated queries. The Pipeline Service does not know or care whether a query was triggered by a user or by a schedule. The execution path is identical.

The scheduled query executor is a logically isolated module. Its internal design supports extraction into a separate service if operational requirements demand it in the future, because it communicates with the Pipeline Service through the same boundary (internal API) that a separate service would use.

### 9.2 Notification Delivery

The notification dispatcher is a subsystem within the Application API. It runs as a background module within the Application API process.

When a query completes (whether user-initiated or scheduled), the notification dispatcher evaluates the organization's notification preferences and delivers notifications through the configured channels. Three notification channels are supported architecturally:

**In-app notifications**: Stored in the database and presented to users when they access the Interface Layer.

**Email notifications**: Sent through an email delivery service.

**Webhook notifications**: Delivered to a URL configured by the organization (for example, a Slack incoming webhook), enabling integration with the organization's existing alerting infrastructure.

The notification dispatcher, like the scheduled query executor, is logically isolated within the Application API and can be extracted into a separate service if needed.

---

## 10. Subscription and Billing

The subscription belongs to the organization, not to individual users. Feature limits are enforced at the organization level based on the subscription tier. Limits may include the number of connected integrations, the number of queries per billing period, the number of users, and access to specific features.

The Application API enforces subscription limits at the point of action: when a user attempts to connect a new integration, submit a query, or invite a new team member, the Application API checks the organization's subscription tier and enforces the applicable limit.

The specific subscription tiers, their pricing, and their feature allocations are configuration, not architecture. They can be defined, modified, and expanded without changes to the system structure.

---

## 11. Data Retention

Query results, transparency logs, activity logs, and exported files accumulate over time. The system supports configurable data retention at the organization level.

Each organization can configure a retention period. Data older than the retention period is automatically purged. The Application API is responsible for enforcing retention policies through a background cleanup process.

The default retention period and the available retention options are configuration, not architecture.

---

## 12. Data Residency and Deployment

The initial deployment is a single-region deployment in the European Union. All organization data, including credentials, query results, logs, and exported files, resides within the EU deployment region.

The system is not designed for multi-region deployment in its initial architecture. However, the data model does not preclude adding a region association to organizations in the future if multi-region capability becomes necessary. This would require deployment of the full stack in additional regions and a routing layer to direct organizations to their designated region.

---

## 13. Deployment Topology

In the development environment, all services run as Docker containers orchestrated by Docker Compose on a single machine. The database runs as a local PostgreSQL container. MCP servers run as local processes alongside the Pipeline Service.

In the production environment, the system deploys as follows:

**Public network segment**: The Interface Layer (static assets served via CDN or static hosting) and the Application API (containerized NestJS service).

**Internal network segment**: The Pipeline Service (containerized Python/FastAPI service), the MCP servers (lightweight processes), the Admin Frontend (static assets), and the Admin API (containerized NestJS service). The internal segment is accessible only via VPN for internal operators and through service-to-service communication for the Application API.

**Data layer**: PostgreSQL (managed database service) and object storage for exported files.

The Application API communicates with the Pipeline Service over the internal network. The Pipeline Service communicates with MCP servers via the MCP protocol (stdio transport for co-located processes, or network transport if scaled separately). Both the Application API and the Admin API connect to the same PostgreSQL instance.

---

## 14. Architectural Invariants

The following rules are absolute and apply to every component, every feature, and every future extension of the system. They cannot be violated without revising this Architecture Contract.

1. **Organization-scoped data isolation.** Every piece of data in the system belongs to an organization. No API endpoint, database query, or background process may expose data across organization boundaries, except for internal operator access through the Admin API.

2. **Read-only infrastructure access.** The product never modifies, creates, or deletes anything in a customer's external infrastructure. Every MCP tool performs read operations only.

3. **Credentials never persist in the Pipeline Service.** Integration credentials exist in the Pipeline Service's memory only during query execution and are discarded immediately upon completion.

4. **The Pipeline Service is stateless.** It does not access the database, does not maintain session state, and treats every request as independent and self-contained.

5. **The Interpreter can only reference existing MCP tools.** It cannot invent tools, construct raw API calls, or generate arbitrary code. If a request cannot be fulfilled with available tools, the Interpreter must report this rather than attempt to improvise.

6. **Every query produces a transparency log.** There are no exceptions. Every MCP tool invocation during query execution is recorded with its parameters, timestamps, and response metadata.

7. **Deterministic execution.** The Execution Engine contains no AI. It reads query plans and executes them step by step using verified MCP tools. AI is confined to the Interpreter (for plan generation) and optionally the Output Engine (for result interpretation).

8. **The Interface Layer communicates only with the Application API.** It never communicates directly with the Pipeline Service, the database, the MCP servers, or any external system.

9. **The Admin API is never exposed to the public internet.** It is deployed on an internal network accessible only via VPN.

10. **Single database, shared schema.** The Application API and the Admin API connect to the same PostgreSQL instance with the same schema. Database migrations are managed by the Application API.

11. **The Application API has no admin endpoints.** All internal operator functionality is served exclusively by the Admin API.

12. **User plan approval before execution.** Every query plan generated by the Interpreter is presented to the user for review and approval before the Execution Engine executes it, unless the user has explicitly opted into automatic execution.
