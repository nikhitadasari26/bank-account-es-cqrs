-- events table: stores the immutable event stream
CREATE TABLE IF NOT EXISTS events (
    event_id UUID PRIMARY KEY,
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    event_number INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    global_id SERIAL,
    UNIQUE (aggregate_id, event_number)
);

CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events(aggregate_id);

-- snapshots table: stores periodic state snapshots
CREATE TABLE IF NOT EXISTS snapshots (
    snapshot_id UUID PRIMARY KEY,
    aggregate_id VARCHAR(255) NOT NULL UNIQUE,
    snapshot_data JSONB NOT NULL,
    last_event_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate_id ON snapshots(aggregate_id);

-- account_summaries table: read model for current account status
CREATE TABLE IF NOT EXISTS account_summaries (
    account_id VARCHAR(255) PRIMARY KEY,
    owner_name VARCHAR(255) NOT NULL,
    balance DECIMAL(19, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(50) NOT NULL,
    version BIGINT NOT NULL
);

-- transaction_history table: read model for transaction list
CREATE TABLE IF NOT EXISTS transaction_history (
    transaction_id VARCHAR(255) PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(19, 4) NOT NULL,
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transaction_history_account_id ON transaction_history(account_id);

-- projection_offsets: tracks how far each projection has processed the global event stream
CREATE TABLE IF NOT EXISTS projection_offsets (
    projection_name VARCHAR(255) PRIMARY KEY,
    last_processed_global_id INTEGER NOT NULL DEFAULT 0
);

-- Initialize offsets
INSERT INTO projection_offsets (projection_name, last_processed_global_id) VALUES ('AccountSummaries', 0) ON CONFLICT DO NOTHING;
INSERT INTO projection_offsets (projection_name, last_processed_global_id) VALUES ('TransactionHistory', 0) ON CONFLICT DO NOTHING;
