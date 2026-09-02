# Database and Storage Architecture

This document describes the SQLite database schema, concurrency configuration, identity resolution mapping, and database helper functions in WhatsApp Multi-Bots.

---

## 1. Engine Configuration

The database layer is managed through `better-sqlite3` (`lib/db.js`) and stores all data in `database.db` located in the project root directory.

### Performance and Concurrency Pragmas

To ensure safe concurrent access from multiple PM2 bot processes without file locking collisions, the database connection enforces the following pragmas:

```javascript
// WAL mode allows concurrent readers alongside one writer without blocking
db.pragma("journal_mode = WAL");

// Wait up to 5000ms if another process holds a write lock
db.pragma("busy_timeout = 5000");

// Normal synchronous pragma provides optimal balance between write speed and crash resilience
db.pragma("synchronous = NORMAL");
```

---

## 2. Table Schemas

### `users`
Stores user profile information, registration status, ban state, and metadata.

| Column | Type | Default | Description |
|:---|:---|:---|:---|
| `id` | `TEXT` | Primary Key | Normalized user JID (`<number>@s.whatsapp.net`). |
| `registered` | `INTEGER` | `0` | Flag (`1` if registered, `0` otherwise). |
| `registered_at` | `INTEGER` | `NULL` | Unix timestamp of registration. |
| `name` | `TEXT` | `NULL` | Custom registered user name. |
| `banned` | `INTEGER` | `0` | Global ban status (`1` if banned, `0` otherwise). |
| `banned_at` | `INTEGER` | `NULL` | Unix timestamp of ban enforcement. |
| `banned_by` | `TEXT` | `NULL` | JID of administrator who issued the ban. |
| `ban_reason` | `TEXT` | `NULL` | Ban explanation note. |
| `meta` | `TEXT` | `'{}'` | JSON serialized string for arbitrary user data extensions (e.g., `isBotAdmin`, `steamId`, `malUsername`, `displayMode`). |

### `groups`
Stores group chat configurations, greeting triggers, and local ban status.

| Column | Type | Default | Description |
|:---|:---|:---|:---|
| `id` | `TEXT` | Primary Key | Group chat JID (`<id>@g.us`). |
| `welcome` | `INTEGER` | `0` | Welcome message toggle (`1` = enabled, `0` = disabled). |
| `welcome_text` | `TEXT` | `''` | Custom welcome template text. |
| `goodbye` | `INTEGER` | `0` | Goodbye message toggle (`1` = enabled, `0` = disabled). |
| `goodbye_text` | `TEXT` | `''` | Custom goodbye template text. |
| `registered` | `INTEGER` | `0` | Group registration status. |
| `registered_at` | `INTEGER` | `NULL` | Unix timestamp of group registration. |
| `registered_by` | `TEXT` | `NULL` | JID of the user who registered the group. |
| `banned` | `INTEGER` | `0` | Group-wide bot deactivation status. |
| `banned_at` | `INTEGER` | `NULL` | Unix timestamp of group deactivation. |
| `banned_by` | `TEXT` | `NULL` | Administrator who issued the group deactivation. |
| `ban_reason` | `TEXT` | `NULL` | Deactivation reason. |
| `auto_replies` | `TEXT` | `'{}'` | JSON dictionary of keyword-to-reply mappings. |
| `meta` | `TEXT` | `'{}'` | JSON serialized string for group configuration extensions. |

### `group_banned_users`
Stores per-group user bans.

| Column | Type | Description |
|:---|:---|:---|
| `group_id` | `TEXT` | Group chat JID. Part of composite Primary Key (`group_id`, `user_id`). |
| `user_id` | `TEXT` | User JID. Part of composite Primary Key (`group_id`, `user_id`). |

### `message_claims`
Coordinates message processing across multiple bot instances sharing a single group.

| Column | Type | Description |
|:---|:---|:---|
| `id` | `TEXT` | WhatsApp Message Key ID (Primary Key). |
| `bot_id` | `TEXT` | Identifier of the bot instance that claimed the message. |
| `created_at` | `INTEGER` | Unix timestamp of the claim. |

### `bot_registry`
Tracks active bot instances and last heartbeat timestamps.

| Column | Type | Description |
|:---|:---|:---|
| `bot_id` | `TEXT` | Bot identifier from `BOT_ID` environment variable (Primary Key). |
| `jid` | `TEXT` | Bot phone number JID. |
| `last_seen` | `INTEGER` | Unix timestamp of last recorded activity. |

### `identity_map`
Maintains bidirectional mappings between WhatsApp Linked Identity Descriptors (`LID`) and Phone Number JIDs (`PN`).

| Column | Type | Description |
|:---|:---|:---|
| `lid` | `TEXT` | Linked Identity Descriptor JID (Primary Key). |
| `pn` | `TEXT` | Standard Phone Number JID (`<number>@s.whatsapp.net`). |

### `reminders`
Stores scheduled user reminder tasks.

| Column | Type | Description |
|:---|:---|:---|
| `id` | `TEXT` | Unique reminder UUID (Primary Key). |
| `user_id` | `TEXT` | Recipient user JID. |
| `chat_id` | `TEXT` | Target chat JID where reminder will be sent. |
| `trigger_time` | `INTEGER` | Unix millisecond timestamp for reminder firing. |
| `message` | `TEXT` | Reminder note content. |
| `created_at` | `INTEGER` | Unix millisecond timestamp when reminder was created. |
| `bot_id` | `TEXT` | Bot instance responsible for dispatching the reminder. |

### `group_message_counts`
Tracks message volume per user per group for sider (lurker) analytics.

| Column | Type | Description |
|:---|:---|:---|
| `group_id` | `TEXT` | Group JID. Part of composite Primary Key (`group_id`, `user_id`). |
| `user_id` | `TEXT` | User JID. Part of composite Primary Key (`group_id`, `user_id`). |
| `count` | `INTEGER` | Total messages sent by user in this group. |

### `reports`
Stores incoming user feedback and issue reports submitted via `!report` / `!feedback`.

| Column | Type | Description |
|:---|:---|:---|
| `id` | `INTEGER` | Auto-incrementing report ID (Primary Key). |
| `type` | `TEXT` | Category of report (`feedback`, `bug`, `report`). |
| `sender` | `TEXT` | JID of the sender. |
| `pushname` | `TEXT` | Display name of the sender. |
| `text` | `TEXT` | Report body content. |
| `is_group` | `INTEGER` | `1` if submitted from group, `0` if private chat. |
| `group_name` | `TEXT` | Name of group (if applicable). |
| `chat_id` | `TEXT` | Originating chat JID. |
| `message_key` | `TEXT` | WhatsApp message key identifier. |
| `replied` | `INTEGER` | Status flag (`1` = answered, `0` = pending). |
| `timestamp` | `INTEGER` | Unix timestamp of submission. |
| `bot_id` | `TEXT` | Bot instance that received the report. |

---

## 3. Database Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_identity_pn ON identity_map(pn);
CREATE INDEX IF NOT EXISTS idx_claims_created ON message_claims(created_at);
CREATE INDEX IF NOT EXISTS idx_reminders_trigger ON reminders(trigger_time);
CREATE INDEX IF NOT EXISTS idx_gmc_group ON group_message_counts(group_id);
CREATE INDEX IF NOT EXISTS idx_reports_type_bot ON reports(type, bot_id);
```

---

## 4. Key Helper Functions in `lib/database.js`

- `resolveUserId(jid)`: Translates an incoming JID (whether LID or standard PN) into its canonical Phone Number JID using the `identity_map` table.
- `saveIdentityMapping(lid, pn)`: Inserts or updates the association between a LID and its corresponding PN.
- `claimMessage(messageId, botId)`: Attempts to atomically claim a message for processing. Returns `true` if this instance succeeded in claiming the message, `false` otherwise.
- `getUser(id)` / `setUser(id, data)`: Retrieves or updates user records with automatic JSON parsing and serialization of the `meta` field.
- `getGroup(id)` / `setGroup(id, data)`: Retrieves or updates group configurations with automated JSON handling for `auto_replies` and `meta`.
- `isBanned(jid)` / `banUser(jid, reason, bannedBy)` / `unbanUser(jid)`: Manages global user ban state.
- `incrementMsgCount(groupId, userId)`: Atomically increments message counter for sider tracking.

---

## 5. Migration Utility

For legacy deployments upgrading from JSON storage, run the included migration script:

```bash
node scripts/migrate_json_to_sqlite.js
```

This script reads legacy JSON files (`data/users.json`, `data/groups.json`), converts data structures into normalized rows, and populates `database.db` inside an atomic transaction.
