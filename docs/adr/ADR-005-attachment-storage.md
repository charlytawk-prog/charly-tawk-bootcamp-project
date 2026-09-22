# ADR-005: Attachment Storage

## Status

Accepted

## Context

The original architecture proposed cloud blob storage, but no cloud storage integration is implemented. The project needs ticket attachments without introducing production infrastructure.

## Decision

Store attachment bytes locally in the repository's `uploads/` directory using Multer disk storage. Persist attachment metadata and the ticket relationship through Prisma in SQLite.

## Rationale

Local storage keeps the attachment workflow runnable without cloud credentials or operational dependencies. It is sufficient for the current learning-focused project phase.

## Consequences

Attachments are available only on the local filesystem and do not provide cloud durability, distributed access, or production-scale behavior. Cloud object storage is deferred until production infrastructure is in scope; the existing metadata boundary permits a later storage-adapter replacement.