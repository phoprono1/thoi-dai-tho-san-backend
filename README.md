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
