import "server-only"

import { neon } from "@neondatabase/serverless"
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "./schema"

export type Database = NeonHttpDatabase<typeof schema>

let database: Database | undefined

export function getDb(): Database {
  if (!database) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for database access")
    }
    // Keep driver configuration errors from echoing a URL into server logs.
    try {
      database = drizzle(neon(connectionString), { schema })
    } catch {
      throw new Error("Invalid DATABASE_URL configuration")
    }
  }
  return database
}
