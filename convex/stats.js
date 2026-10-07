import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const syncDailyTotal = mutation({
  args: { date: v.string(), totalMs: v.number(), laps: v.optional(v.array(v.number())), tags: v.optional(v.record(v.string(), v.number())) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called syncDailyTotal without authentication present");
    }
    
    // Check if entry exists for this user and date
    const existing = await ctx.db
      .query("stats")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", args.date)
      )
      .unique();

    if (existing) {
      const mergedTags = { ...(existing.tags || {}) };
      if (args.tags) {
        for (const [tag, duration] of Object.entries(args.tags)) {
          mergedTags[tag] = Math.max(mergedTags[tag] || 0, duration);
        }
      }
      const mergedLaps = (args.laps && args.laps.length >= (existing.laps?.length || 0))
        ? args.laps
        : (existing.laps || []);

      await ctx.db.patch(existing._id, { 
        totalMs: Math.max(args.totalMs, existing.totalMs || 0),
        laps: mergedLaps,
        tags: mergedTags
      });
    } else {
      await ctx.db.insert("stats", {
        userId: identity.subject,
        date: args.date,
        totalMs: args.totalMs,
        laps: args.laps || [],
        tags: args.tags || {}
      });
    }
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const stats = await ctx.db
      .query("stats")
      .withIndex("by_user_date", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(400);
      
    return stats;
  },
});

export const getStreakStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const stats = await ctx.db
      .query("stats")
      .withIndex("by_user_date", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(400);
      
    return stats;
  },
});
