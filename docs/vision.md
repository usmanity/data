# Personal Data

A personal data platform for collecting, preserving, connecting, and exploring the digital record of one person's life.

The project is inspired by the **Quantified Self** movement, also known as self-tracking or personal informatics. It extends beyond deliberately tracked metrics: the long-term aim is to bring together both structured and unstructured data that is already collected across devices, apps, and online services.

## Vision

Create one durable, user-controlled home for personal data, with standard ways to bring data in and get data out. The system should make it possible to inspect history, discover relationships across domains, calculate useful metrics, and build charts, tables, dashboards, or other experiences without trapping the underlying data in any one interface.

## Goals

- Collect personal data from many independent sources.
- Preserve source data and enough provenance to understand where and when it came from.
- Normalize related records into a coherent model while retaining the original data when useful.
- Support both structured measurements and unstructured personal records.
- Provide stable APIs for importing, querying, and exporting data.
- Automate ongoing collection through scheduled syncs, webhooks, and platform integrations.
- Support manual entry for information that has no digital source.
- Make the collected data useful through search, summaries, metrics, tables, charts, and dashboards.
- Keep the platform extensible so a new data source can be added without redesigning the whole system.
- Keep the data portable and under the user's control.

## Known data domains (pending implementation)

### Music

- Listening history and listening time
- Artists, albums, tracks, and genres
- Spotify and Last.fm activity

### Health and activity

- Apple Health records available through HealthKit
- Workouts, distance, and other health measurements
- Cycling mileage and related activity

### Finances

- Net worth over time
- Account balances, assets, liabilities, and other financial metrics
- Possibly available thru Monarch app

### Software development

- Commits per day or week
- Contribution activity across repositories
- Lines added, changed, or removed
- Other GitHub or source-control activity
- AI coding agent usage

### Personal inventory and facts

- Bikes and other owned equipment
- Counts, attributes, events, and changes over time

### Unstructured records

- Notes, documents, journal-like entries, and other records that do not fit a fixed metric schema
- Attachments or source exports when preserving the original artifact matters
- Blogging activity
- Youtube posts

This list is illustrative rather than exhaustive.

## Ways data enters the system

- Direct integrations with third-party APIs such as Spotify, Last.fm, Strava, and GitHub
- Scheduled jobs that periodically fetch new or changed records
- Webhooks from services that can push events
- File imports and historical exports
- Manual entry through an API or future user interface
- An auxiliary iOS app that reads data exposed by Apple SDKs, especially HealthKit, with the user's permission, and securely syncs it to the platform

Every ingestion path should be incremental and repeatable: running an import twice should not create duplicate history.

## Ways data leaves the system

- A documented query API
- Complete exports in common, durable formats
- Domain-specific summaries and calculated metrics
- Charts, dashboards, and exploratory views
- Access for future personal tools and applications

## Guiding principles

- **User ownership:** the platform exists for the person represented by the data.
- **Portability:** raw and normalized data should be exportable without depending on the application forever.
- **Provenance:** imported records should identify their source, source identifier, and relevant timestamps.
- **Fidelity:** normalization should not silently discard meaningful source information.
- **Incremental ingestion:** connectors should support reliable synchronization as data changes over time.
- **Extensibility:** integrations and derived metrics should be modular.
- **Security and privacy:** the sensitivity of a unified personal dataset must shape authentication, storage, logging, backups, and deployment.
- **Useful over exhaustive:** begin with a small end-to-end slice, then expand one data source at a time.

## Initial direction

The first implementation should prove the complete loop for a small number of relatively simple sources:

1. Import records from a source.
2. Preserve their provenance and prevent duplicates.
3. Store and query the records through a stable internal model.
4. Expose the records through an API and a portable export.
5. Derive at least one useful metric or visualization.
6. Repeat the import to demonstrate incremental synchronization.

The exact first sources, storage model, technology stack, privacy model, and deployment target are intentionally undecided. Those choices should follow from the data and operating requirements rather than precede them.

## Likely project surfaces

Over time, the project may include:

- A core data store and provenance model
- A backend API for ingestion and querying
- Source-specific connectors and scheduled workers
- A web interface for exploration and visualization
- An iOS companion app for Apple-platform data
- Import, export, backup, and recovery tooling

These are conceptual boundaries, not an implementation commitment.

## Next step

Define the first vertical slice by choosing one or two initial data sources and answering the architectural questions they expose: where the system runs, how sensitive data is protected, what the canonical record model looks like, and how imports are reconciled over time.
