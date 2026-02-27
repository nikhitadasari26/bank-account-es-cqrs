const express = require('express');
require('dotenv').config();
const commandHandlers = require('./commands/commandHandlers');
const queryHandlers = require('./queries/queryHandlers');
const projector = require('./projections/projector');
const db = require('./db/db');
const pg = require('pg');

// Parse DECIMAL as float
pg.types.setTypeParser(1700, (val) => parseFloat(val));

const app = express();
app.use(express.json());

const port = process.env.API_PORT || 8080;

// Health check
app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.status(200).json({ status: 'UP' });
    } catch (e) {
        res.status(500).json({ status: 'DOWN', error: e.message });
    }
});

// Welcome route
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Welcome to the Bank Account Management API (ES/CQRS)',
        documentation: 'Refer to the README.md and walkthrough.md for API documentation and usage examples.',
        endpoints: {
            health: '/health',
            accounts: '/api/accounts',
            projections: '/api/projections/status'
        }
    });
});

// Command Routes
app.post('/api/accounts', async (req, res) => {
    try {
        const result = await commandHandlers.handleCreateAccount(req.body);
        res.status(202).json(result);
    } catch (e) {
        res.status(e.status || 400).json({ error: e.message });
    }
});

app.post('/api/accounts/:accountId/deposit', async (req, res) => {
    try {
        const result = await commandHandlers.handleDeposit(req.params.accountId, req.body);
        res.status(202).json(result);
    } catch (e) {
        res.status(e.status || 400).json({ error: e.message });
    }
});

app.post('/api/accounts/:accountId/withdraw', async (req, res) => {
    try {
        const result = await commandHandlers.handleWithdraw(req.params.accountId, req.body);
        res.status(202).json(result);
    } catch (e) {
        res.status(e.status || 400).json({ error: e.message });
    }
});

app.post('/api/accounts/:accountId/close', async (req, res) => {
    try {
        const result = await commandHandlers.handleClose(req.params.accountId, req.body);
        res.status(202).json(result);
    } catch (e) {
        res.status(e.status || 400).json({ error: e.message });
    }
});

// Query Routes
app.get('/api/accounts/:accountId', async (req, res) => {
    try {
        const result = await queryHandlers.getAccountSummary(req.params.accountId);
        res.status(200).json(result);
    } catch (e) {
        res.status(e.status || 404).json({ error: e.message });
    }
});

app.get('/api/accounts/:accountId/events', async (req, res) => {
    try {
        const result = await queryHandlers.getAccountEvents(req.params.accountId);
        res.status(200).json(result);
    } catch (e) {
        res.status(e.status || 404).json({ error: e.message });
    }
});

app.get('/api/accounts/:accountId/transactions', async (req, res) => {
    try {
        const { page, pageSize } = req.query;
        const result = await queryHandlers.getTransactionHistory(req.params.accountId, page, pageSize);
        res.status(200).json(result);
    } catch (e) {
        res.status(e.status || 404).json({ error: e.message });
    }
});

app.get('/api/accounts/:accountId/balance-at/:timestamp', async (req, res) => {
    try {
        const result = await queryHandlers.getBalanceAt(req.params.accountId, req.params.timestamp);
        res.status(200).json(result);
    } catch (e) {
        res.status(e.status || 404).json({ error: e.message });
    }
});

// Admin Routes
app.post('/api/projections/rebuild', async (req, res) => {
    try {
        // Rebuild in background or wait? Req 15 says 202 Accepted.
        projector.rebuildProjections().catch(console.error);
        res.status(202).json({ message: 'Projection rebuild initiated.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/projections/status', async (req, res) => {
    try {
        const result = await queryHandlers.getProjectionsStatus();
        res.status(200).json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
