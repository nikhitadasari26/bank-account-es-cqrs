const db = require('../db/db');

async function projectEvent(event) {
    const { event_type, event_data, aggregate_id, timestamp, event_number } = event;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        switch (event_type) {
            case 'AccountCreated':
                await client.query(
                    `INSERT INTO account_summaries (account_id, owner_name, balance, currency, status, version)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (account_id) DO NOTHING`,
                    [
                        aggregate_id,
                        event_data.ownerName,
                        event_data.initialBalance,
                        event_data.currency,
                        'OPEN',
                        event_number
                    ]
                );
                break;

            case 'MoneyDeposited':
                // Update summary
                await client.query(
                    `UPDATE account_summaries 
           SET balance = balance + $1, version = $2
           WHERE account_id = $3 AND version < $2`,
                    [event_data.amount, event_number, aggregate_id]
                );
                // Insert history
                await client.query(
                    `INSERT INTO transaction_history (transaction_id, account_id, type, amount, description, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (transaction_id) DO NOTHING`,
                    [
                        event_data.transactionId,
                        aggregate_id,
                        'DEPOSIT',
                        event_data.amount,
                        event_data.description,
                        timestamp
                    ]
                );
                break;

            case 'MoneyWithdrawn':
                // Update summary
                await client.query(
                    `UPDATE account_summaries 
           SET balance = balance - $1, version = $2
           WHERE account_id = $3 AND version < $2`,
                    [event_data.amount, event_number, aggregate_id]
                );
                // Insert history
                await client.query(
                    `INSERT INTO transaction_history (transaction_id, account_id, type, amount, description, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (transaction_id) DO NOTHING`,
                    [
                        event_data.transactionId,
                        aggregate_id,
                        'WITHDRAW',
                        event_data.amount,
                        event_data.description,
                        timestamp
                    ]
                );
                break;

            case 'AccountClosed':
                await client.query(
                    `UPDATE account_summaries 
           SET status = 'CLOSED', version = $1
           WHERE account_id = $2 AND version < $1`,
                    [event_number, aggregate_id]
                );
                break;
        }

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function rebuildProjections() {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM account_summaries');
        await client.query('DELETE FROM transaction_history');

        const eventsRes = await client.query('SELECT * FROM events ORDER BY timestamp ASC, event_number ASC');
        const events = eventsRes.rows;

        await client.query('COMMIT');

        // Project all events sequentially
        for (const event of events) {
            await projectEvent(event);
        }
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

module.exports = {
    projectEvent,
    rebuildProjections,
};
