CREATE TABLE IF NOT EXISTS subscriptions
(
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);