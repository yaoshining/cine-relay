import {integer, jsonb, pgTable, primaryKey, text, timestamp, uuid} from 'drizzle-orm/pg-core';

// Constraints, FK to consumer_keys and maintenance indexes: authoritative migration 0008.
const time = (name:string) => timestamp(name,{withTimezone:true,mode:'string'});
export const tvRequestWindows = pgTable('tv_request_windows',{
  consumerId:uuid('consumer_id').primaryKey(), minute:time('minute').notNull(), requests:integer('requests').notNull(),
});
export const tvCache = pgTable('tv_cache',{
  resource:text('resource').primaryKey(),payload:jsonb('payload'),expiresAt:time('expires_at'),purgeAfter:time('purge_after').notNull(),lease:uuid('lease'),leaseUntil:time('lease_until'),
});
export const tvSearchOperations = pgTable('tv_search_operations',{
  consumerId:uuid('consumer_id').notNull(),searchId:uuid('search_id').notNull(),conditions:jsonb('conditions').notNull(),shown:jsonb('shown').notNull().default({}),selected:text('selected'),createdAt:time('created_at').notNull().defaultNow(),confirmedAt:time('confirmed_at'),
},t=>[primaryKey({columns:[t.consumerId,t.searchId]})]);
