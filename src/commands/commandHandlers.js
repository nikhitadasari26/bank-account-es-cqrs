const eventStore = require('../db/eventStore');
const BankAccount = require('../domain/BankAccount');
const { v4: uuidv4 } = require('uuid');
const projector = require('../projections/projector');

async function loadAccount(accountId) {
    const account = new BankAccount(accountId);
    const snapshot = await eventStore.getSnapshot(accountId);

    let startEventNumber = 0;
    if (snapshot) {
        account.ownerName = snapshot.snapshot_data.ownerName;
        account.balance = snapshot.snapshot_data.balance;
        account.currency = snapshot.snapshot_data.currency;
        account.status = snapshot.snapshot_data.status;
        account.version = snapshot.last_event_number;
        startEventNumber = snapshot.last_event_number;
    }

    const events = await eventStore.getEvents(accountId);
    for (const event of events) {
        if (event.event_number > startEventNumber) {
            account.apply(event);
        }
    }
    return account;
}

async function handleCreateAccount(command) {
    const { accountId, ownerName, initialBalance, currency } = command;

    // Check if events exist for this ID
    const existingEvents = await eventStore.getEvents(accountId);
    if (existingEvents.length > 0) {
        const error = new Error('Account already exists');
        error.status = 409;
        throw error;
    }

    const event = {
        aggregateId: accountId,
        aggregateType: 'BankAccount',
        eventType: 'AccountCreated',
        eventNumber: 1,
        data: { accountId, ownerName, initialBalance, currency }
    };

    await eventStore.saveEvents([event]);

    // For this project, update projections synchronously
    const savedEvents = await eventStore.getEvents(accountId);
    await projector.projectEvent(savedEvents[savedEvents.length - 1]);

    return { message: 'Account creation accepted' };
}

async function handleDeposit(accountId, command) {
    const { amount, description, transactionId } = command;
    const account = await loadAccount(accountId);

    if (!account.ownerName) {
        const error = new Error('Account not found');
        error.status = 404;
        throw error;
    }

    try {
        account.validateDeposit(amount);
    } catch (e) {
        e.status = 409;
        throw e;
    }

    const event = {
        aggregateId: accountId,
        aggregateType: 'BankAccount',
        eventType: 'MoneyDeposited',
        eventNumber: account.version + 1,
        data: { amount, description, transactionId }
    };

    await processEvent(account, event);
    return { message: 'Deposit accepted' };
}

async function handleWithdraw(accountId, command) {
    const { amount, description, transactionId } = command;
    const account = await loadAccount(accountId);

    if (!account.ownerName) {
        const error = new Error('Account not found');
        error.status = 404;
        throw error;
    }

    try {
        account.validateWithdrawal(amount);
    } catch (e) {
        e.status = 409;
        throw e;
    }

    const event = {
        aggregateId: accountId,
        aggregateType: 'BankAccount',
        eventType: 'MoneyWithdrawn',
        eventNumber: account.version + 1,
        data: { amount, description, transactionId }
    };

    await processEvent(account, event);
    return { message: 'Withdrawal accepted' };
}

async function handleClose(accountId, command) {
    const { reason } = command;
    const account = await loadAccount(accountId);

    if (!account.ownerName) {
        const error = new Error('Account not found');
        error.status = 404;
        throw error;
    }

    try {
        account.validateClose();
    } catch (e) {
        e.status = 409;
        throw e;
    }

    const event = {
        aggregateId: accountId,
        aggregateType: 'BankAccount',
        eventType: 'AccountClosed',
        eventNumber: account.version + 1,
        data: { reason }
    };

    await processEvent(account, event);
    return { message: 'Account closure accepted' };
}

async function processEvent(account, event) {
    let snapshot = null;

    // Snapshotting triggered when the 51st, 101st, etc. event is persisted
    // We snapshot the state AFTER the 50th, 100th, etc. 
    // If the current event is 51, we snapshot the state including the 50 previous events.
    if ((event.eventNumber - 1) > 0 && (event.eventNumber - 1) % 50 === 0) {
        // The account object already has state up to event.eventNumber - 1 after loadAccount
        snapshot = {
            aggregateId: account.accountId,
            lastEventNumber: account.version,
            data: {
                ownerName: account.ownerName,
                balance: account.balance,
                currency: account.currency,
                status: account.status
            }
        };
    }

    await eventStore.saveEvents([event], snapshot);

    // Sync projection
    const savedEvents = await eventStore.getEvents(account.accountId);
    await projector.projectEvent(savedEvents[savedEvents.length - 1]);
}

module.exports = {
    handleCreateAccount,
    handleDeposit,
    handleWithdraw,
    handleClose,
};
