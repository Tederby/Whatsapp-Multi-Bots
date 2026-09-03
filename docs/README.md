# Documentation Index

Welcome to the technical documentation for WhatsApp Multi-Bots, a scalable, multi-instance WhatsApp bot framework built with Baileys, Node.js (ES Modules), and SQLite (WAL mode).

## Documentation Structure

The documentation is organized into the following guides:

- [Development Journal and Changelog](CHANGELOG.md)
  Chronological record of feature releases, architectural milestones, bug fixes, and development decisions.

- [System Architecture and Pipeline](ARCHITECTURE.md)
  Detailed explanation of the message processing pipeline, hot-reloading architecture, multi-instance concurrency, and background services.

- [Command Development Guide](COMMAND_DEVELOPMENT.md)
  Comprehensive guide for writing new commands, declarative permission flags, context builder objects, reply handlers, and UI formatting standards.

- [Database and Storage Architecture](DATABASE.md)
  Schema reference for SQLite tables, Write-Ahead Logging (WAL) configuration, identity resolution mapping (LID vs PN), and migration utilities.

- [Configuration and Deployment Guide](CONFIGURATION_DEPLOYMENT.md)
  Environment variables, multi-bot PM2 configuration, headless pairing code setup, OS prerequisite installation, and diagnostic dashboard.

## Project Overview

- Runtime: Node.js (ES Modules)
- WhatsApp Engine: Baileys
- Storage: better-sqlite3 with WAL mode
- Process Management: PM2 (Multi-instance concurrency)
- Media Tooling: FFmpeg, yt-dlp, Puppeteer, Jimp, wa-sticker-formatter
