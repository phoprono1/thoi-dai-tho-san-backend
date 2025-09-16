# Game Backend API - Thời Đại Thợ Săn

Backend API server cho game Thời Đại Thợ Săn, được xây dựng bằng NestJS framework.

## Features

- **User Authentication**: JWT-based authentication with login/register
- **Real-time Chat**: WebSocket-powered global chat system
- **Game Systems**: Character classes, guilds, quests, combat system
- **Database**: PostgreSQL with TypeORM
- **API Documentation**: Swagger/OpenAPI integration

## Tech Stack

- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with Passport
- **Real-time**: Socket.IO for WebSockets
- **Documentation**: Swagger/OpenAPI
- **Language**: TypeScript

## Environment Setup

1. Copy `.env.example` to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

2. Update the following variables in `.env`:
```env
# Database
DATABASE_HOST=your_database_host
DATABASE_PORT=5432
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_password
DATABASE_NAME=your_database_name

# JWT Secret
JWT_SECRET=your_super_secure_jwt_secret

# Application
PORT=3005
NODE_ENV=production

# Frontend URL for CORS
FRONTEND_URL=https://your-frontend-domain.com
```

## Installation

```bash
# Install dependencies
npm install
```

## Development

```bash
# Development with watch mode
npm run start:dev

# Debug mode
npm run start:debug
```

## Production

```bash
# Build the application
npm run build

# Start production server
npm run start:prod
```

## API Endpoints

- **Auth**: `/auth/login`, `/auth/register`
- **Users**: `/users/*`
- **Chat**: `/chat/*` + WebSocket on same port
- **Guilds**: `/guilds/*`
- **Quests**: `/quests/*`
- **Combat**: `/combat/*`

## WebSocket Events

- **Chat System**: `join_world`, `send_world_message`
- **Real-time Updates**: Game state synchronization

## Database Migrations

```bash
# Run migrations
npm run migration:run

# Create new migration
npm run migration:generate -- -n MigrationName
```

## API Documentation

Swagger documentation available at: `http://localhost:3005/api`

## Deployment

This backend is designed to be deployed on platforms like:
- Render.com
- Heroku
- Railway
- Digital Ocean

Make sure to:
1. Set all environment variables
2. Configure PostgreSQL database
3. Set `NODE_ENV=production`
4. Configure CORS for your frontend domain

## Production & Migrations (important)

This project now relies on TypeORM migrations for schema changes in non-development environments. A few notes to help you deploy safely:

- TypeORM `synchronize` is enabled only in development. In production the code expects migrations to be applied instead of auto-syncing the schema.
- There are two ways migrations can be applied when you start the service:
	- Set `MIGRATIONS_RUN=true` in the environment so TypeORM runs pending migrations automatically when DataSource is initialized.
	- Or keep `MIGRATIONS_RUN=false` and run the project's migration script explicitly before starting the app. The project's start script (`start.sh`) already runs the migration runner (`run-migrations.js`) by default when building containers.

Recommended environment variables for production:

```env
NODE_ENV=production
MIGRATIONS_RUN=false   # control whether TypeORM should auto-run migrations at DataSource init
STALE_PLAYER_SECONDS=120   # inactivity threshold (seconds) used by the room cleanup cron
DATABASE_HOST=... 
DATABASE_PORT=5432
DATABASE_USERNAME=...
DATABASE_PASSWORD=...
DATABASE_NAME=...
```

How to run migrations locally (examples):

- Using the project script (recommended):

```bash
# from backend/
npm run migration:run
```

- Or after building the project you can run the compiled runner directly:

```bash
npm run build
node dist/run-migrations.js
```

Migration safety note:

- The migration that adds the new presence column (`lastSeen`) backfills existing rows with the current timestamp (NOW()) to avoid immediately treating long-lived rooms as stale. This is intentional and prevents mass deletions on first rollout. If you want older rooms to be considered stale immediately you can run a custom SQL update after the migration to set `lastSeen` to an older timestamp for selected rows.

Heartbeat & stale-room cleanup (what the frontend needs)

- The backend records a `lastSeen` timestamp for players in rooms and runs a cron job that marks players as LEFT if they haven't been seen for longer than `STALE_PLAYER_SECONDS`. Empty WAITING rooms are cleaned up automatically.
- To keep a player active while they have the room open, the frontend should emit a periodic heartbeat over the room socket:

	- Event: `heartbeat`
	- Payload: { roomId, userId }
	- Frequency: ~20–30 seconds (choose less than STALE_PLAYER_SECONDS)

- If the frontend doesn't send heartbeats (for example old clients), the server-side cron will still mark players as LEFT after the threshold and cleanup empty rooms.

If you need help wiring the heartbeat into the frontend socket hook, tell me which file contains your room socket hook and I can add the client-side code for you.

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
