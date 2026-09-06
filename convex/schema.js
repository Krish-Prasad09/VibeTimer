import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  stats: defineTable({
    userId: v.string(), // Clerk user ID
    date: v.string(),   // YYYY-MM-DD
    totalMs: v.number(),
    laps: v.optional(v.array(v.number())), // Array to store individual lap durations in ms
    tags: v.optional(v.record(v.string(), v.number())), // Record to store duration per tag
  }).index("by_user_date", ["userId", "date"])
});
