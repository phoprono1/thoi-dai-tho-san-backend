import { EventEmitter } from 'events';

// Lightweight process-local event emitter for cross-service notifications
// This avoids circular DI between UsersService and ChatGateway while still
// allowing server-side socket broadcasts when DB changes occur.
export const guildEvents = new EventEmitter();

export type GuildLeaderChangedPayload = {
  guildId: number;
  oldLeaderId: number | null;
  newLeaderId: number | null;
  timestamp?: string;
};

export type GuildJoinRequestPayload = {
  guildId: number;
  userId: number;
  username?: string;
  joinedAt?: string;
};

export type GuildMemberKickedPayload = {
  guildId: number;
  userId: number;
  kickedBy: number | null;
  timestamp?: string;
};

export type GuildMemberApprovedPayload = {
  guildId: number;
  userId: number;
  approvedBy: number | null;
  timestamp?: string;
};

export type GuildJoinRequestRejectedPayload = {
  guildId: number;
  userId: number;
  rejectedBy?: number | null;
  timestamp?: string;
};

export type GuildContributedPayload = {
  guildId: number;
  userId: number;
  amount: number;
  timestamp?: string;
};

export type GuildInvitePayload = {
  guildId: number;
  guildName?: string;
  inviterId: number;
  inviterUsername?: string;
  timestamp?: string;
};
