const db = require('./db');
const { v4: uuidv4 } = require('uuid');

async function getEvents(aggregateId) {
    const res = await db.query(
        'SELECT * FROM events WHERE aggregate_id = $1 ORDER BY event_number ASC',
        [aggregateId]
    );
    return res.rows;
}

async function getSnapshot(aggregateId) {
    const res = await db.query(
        'SELECT * FROM snapshots WHERE aggregate_id = $1',
        [aggregateId]
    );
    return res.rows[0];
}

async function saveEvents(events, snapshot = null) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        for (const event of events) {
            await client.query(
                `INSERT INTO events (event_id, aggregate_id, aggregate_type, event_type, event_data, event_number, timestamp, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    event.eventId || uuidv4(),
                    event.aggregateId,
                    event.aggregateType,
                    event.eventType,
                    JSON.stringify(event.data),
                    event.eventNumber,
                    event.timestamp || new Date(),
                    event.version || 1
                ]
            );
        }

        if (snapshot) {
            await client.query(
                `INSERT INTO snapshots (snapshot_id, aggregate_id, snapshot_data, last_event_number, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (aggregate_id) DO UPDATE 
         SET snapshot_data = EXCLUDED.snapshot_data, 
             last_event_number = EXCLUDED.last_event_number,
             created_at = EXCLUDED.created_at`,
                [
                    uuidv4(),
                    snapshot.aggregateId,
                    JSON.stringify(snapshot.data),
                    snapshot.lastEventNumber,
                    new Date()
                ]
            );
        }

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

module.exports = {
    getEvents,
    getSnapshot,
    saveEvents,
};
