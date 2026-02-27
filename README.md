# Bank Account Management System (ES/CQRS)

A fully functional bank account management API built with Node.js and PostgreSQL using Event Sourcing and Command Query Responsibility Segregation (CQRS) architectural patterns.

## Features

- **Event Sourcing**: All state changes are stored as immutable events in an `events` table.
- **CQRS**: Separation of write models (commands) and read models (queries/projections).
- **Snapshotting**: Automatic state snapshots every 50 events to optimize performance.
- **Time-Travel Queries**: Retrieve account balance at any specific point in time.
- **Projection Rebuilding**: Administrative endpoint to rebuild read models from the event store.
- **Containerization**: Fully Dockerized setup for consistent deployment.

## Tech Stack

- **Runtime**: Node.js (Express)
- **Database**: PostgreSQL
- **Infrastructure**: Docker & Docker Compose
- **Key Libraries**: `pg`, `uuid`, `dotenv`

## Getting Started

### Prerequisites

- Docker and Docker Compose installed.

### Setup

1. Clone the repository.
2. Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Start the application:
   ```bash
   docker-compose up --build
   ```

The API will be available at `http://localhost:8080`.

## API Endpoints

### Commands (Write)

- `POST /api/accounts`: Create a new account.
- `POST /api/accounts/{accountId}/deposit`: Deposit money.
- `POST /api/accounts/{accountId}/withdraw`: Withdraw money.
- `POST /api/accounts/{accountId}/close`: Close an account (if balance is zero).

### Queries (Read)

- `GET /api/accounts/{accountId}`: Get current account summary.
- `GET /api/accounts/{accountId}/events`: Get full event stream for an account.
- `GET /api/accounts/:accountId/transactions`: Get paginated transaction history.
- `GET /api/accounts/{accountId}/balance-at/{timestamp}`: Time-travel query.

### System/Admin

- `GET /health`: System health check.
- `GET /api/projections/status`: Status of projections (lag, events processed).
- `POST /api/projections/rebuild`: Rebuild all read models from the event store.

## Project Structure

```
├── src/
│   ├── commands/      # Command handlers (write side)
│   ├── queries/       # Query handlers (read side)
│   ├── projections/   # Projectors for updating read models
│   ├── domain/        # Aggregate roots (business logic)
│   ├── db/            # Database connection and event store logic
│   └── server.js      # Entry point
├── seeds/             # Database initialization scripts
├── Dockerfile
└── docker-compose.yml
```

## Snapshotting Strategy

The system monitors event counts for each account. Every 50 events, a snapshot is created and saved to the `snapshots` table. When loading an account, the latest snapshot is loaded first, and only subsequent events are replayed to reconstruct the current state.
