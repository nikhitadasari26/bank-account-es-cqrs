class BankAccount {
    constructor(accountId) {
        this.accountId = accountId;
        this.ownerName = '';
        this.balance = 0;
        this.currency = 'USD';
        this.status = 'OPEN';
        this.version = 0;
        this.seenTransactions = new Set();
    }

    static create(accountId, ownerName, initialBalance, currency) {
        const account = new BankAccount(accountId);
        account.ownerName = ownerName;
        account.balance = initialBalance;
        account.currency = currency;
        return account;
    }

    apply(event) {
        const { event_type, event_data } = event;

        switch (event_type) {
            case 'AccountCreated':
                this.accountId = event_data.accountId;
                this.ownerName = event_data.ownerName;
                this.balance = parseFloat(event_data.initialBalance);
                this.currency = event_data.currency;
                this.status = 'OPEN';
                break;
            case 'MoneyDeposited':
                this.balance += parseFloat(event_data.amount);
                break;
            case 'MoneyWithdrawn':
                this.balance -= parseFloat(event_data.amount);
                break;
            case 'AccountClosed':
                this.status = 'CLOSED';
                break;
            default:
                console.warn(`Unknown event type: ${event_type}`);
        }

        if (event_data.transactionId) {
            this.seenTransactions.add(event_data.transactionId);
        }
        this.version = event.event_number;
    }

    // Business logic validations
    isDuplicate(transactionId) {
        return transactionId && this.seenTransactions.has(transactionId);
    }

    validateDeposit(amount) {
        if (this.status === 'CLOSED') {
            throw new Error('Account is closed');
        }
        if (amount <= 0) {
            throw new Error('Deposit amount must be positive');
        }
    }

    validateWithdrawal(amount) {
        if (this.status === 'CLOSED') {
            throw new Error('Account is closed');
        }
        if (amount <= 0) {
            throw new Error('Withdrawal amount must be positive');
        }
        if (this.balance < amount) {
            throw new Error('Insufficient funds');
        }
    }

    validateClose() {
        if (this.status === 'CLOSED') {
            throw new Error('Account is already closed');
        }
        if (this.balance !== 0) {
            throw new Error('Account balance must be zero to close');
        }
    }
}

module.exports = BankAccount;
