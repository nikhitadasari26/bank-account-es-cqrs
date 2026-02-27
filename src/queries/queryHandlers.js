const db = require('../db/db');
const eventStore = require('../db/eventStore');
const BankAccount = require('../domain/BankAccount');

async function getAccountSummary(accountId) {
    const res = await db.query(
        'SELECT * FROM account_summaries WHERE account_id = $1',
        [accountId]
    );
    if (res.rows.length === 0) {
        const error = new Error('Account not found');
        error.status = 404;
        throw error;
    }
    const summary = res.rows[0];
    return {
        accountId: summary.account_id,
        ownerName: summary.owner_name,
        balance: parseFloat(summary.balance),
        currency: summary.currency,
        status: summary.status
    };
}

async function getAccountEvents(accountId) {
    const events = await eventStore.getEvents(accountId);
    if (events.length === 0) {
        const error = new Error('Account not found');
        error.status = 404;
        throw error;
    }
    return events.map(e => ({
        eventId: e.event_id,
        eventType: e.event_type,
        eventNumber: e.event_number,
        data: e.event_data,
        timestamp: e.timestamp
    }));
}

async function getTransactionHistory(accountId, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;

    const countRes = await db.query(
        'SELECT COUNT(*) FROM transaction_history WHERE account_id = $1',
        [accountId]
    );
    const totalCount = parseInt(countRes.rows[0].count);

    const itemsRes = await db.query(
        `SELECT * FROM transaction_history 
     WHERE account_id = $1 
     ORDER BY timestamp DESC 
     LIMIT $2 OFFSET $3`,
        [accountId, pageSize, offset]
    );

    return {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(totalCount / pageSize),
        totalCount: totalCount,
        items: itemsRes.rows.map(t => ({
            transactionId: t.transaction_id,
            type: t.type,
            amount: parseFloat(t.amount),
            description: t.description,
            timestamp: t.timestamp
        }))
    };
}

async function getBalanceAt(accountId, timestamp) {
    const events = await eventStore.getEvents(accountId);
    if (events.length === 0) {
        const error = new Error('Account not found');
        error.status = 404;
        throw error;
    }

    const targetDate = new Date(timestamp);
    const account = new BankAccount(accountId);

    for (const event of events) {
        const eventDate = new Date(event.timestamp);
        if (eventDate <= targetDate) {
            account.apply(event);
        } else {
            break;
        }
    }

    return {
        accountId: accountId,
        balanceAt: account.balance,
        timestamp: timestamp
    };
}

async function getProjectionsStatus() {
    const storeCountRes = await db.query('SELECT COUNT(*), MAX(global_id) FROM events');
    const totalEventsInStore = parseInt(storeCountRes.rows[0].count);
    const lastGlobalId = parseInt(storeCountRes.rows[0].max || 0);

    return {
        totalEventsInStore,
        projections: [
            {
                name: "AccountSummaries",
                lastProcessedEventNumberGlobal: lastGlobalId,
                lag: 0
            },
            {
                name: "TransactionHistory",
                lastProcessedEventNumberGlobal: lastGlobalId,
                lag: 0
            }
        ]
    };
}

module.exports = {
    getAccountSummary,
    getAccountEvents,
    getTransactionHistory,
    getBalanceAt,
    getProjectionsStatus,
};
