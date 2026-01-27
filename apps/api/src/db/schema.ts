import { pgTable, text, timestamp, boolean, integer, index, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  categories: many(categories),
  subscriptions: many(subscriptions),
  userArticles: many(userArticles),
  preferences: one(userPreferences),
  refreshTokens: many(refreshTokens),
}));

// Refresh tokens table
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('refresh_tokens_user_id_idx').on(table.userId),
  index('refresh_tokens_token_idx').on(table.token),
]);

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

// User preferences table
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  theme: varchar('theme', { length: 20 }).default('system').notNull(),
  accentColor: varchar('accent_color', { length: 20 }).default('#3b82f6').notNull(),
  layout: varchar('layout', { length: 20 }).default('list').notNull(),
  articleView: varchar('article_view', { length: 20 }).default('split-vertical').notNull(),
  fontSize: varchar('font_size', { length: 20 }).default('medium').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

// Categories table
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  color: varchar('color', { length: 20 }).default('#3b82f6').notNull(),
  parentId: uuid('parent_id'),
  order: integer('order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('categories_user_id_idx').on(table.userId),
  index('categories_parent_id_idx').on(table.parentId),
]);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryChildren',
  }),
  children: many(categories, { relationName: 'categoryChildren' }),
  subscriptions: many(subscriptions),
}));

// Feeds table
export const feeds = pgTable('feeds', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull().unique(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  siteUrl: text('site_url'),
  iconUrl: text('icon_url'),
  lastFetchedAt: timestamp('last_fetched_at'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('feeds_url_idx').on(table.url),
]);

export const feedsRelations = relations(feeds, ({ many }) => ({
  subscriptions: many(subscriptions),
  articles: many(articles),
}));

// Subscriptions table (user -> feed with category)
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  feedId: uuid('feed_id').notNull().references(() => feeds.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  customTitle: varchar('custom_title', { length: 500 }),
  order: integer('order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('subscriptions_user_feed_idx').on(table.userId, table.feedId),
  index('subscriptions_user_id_idx').on(table.userId),
  index('subscriptions_category_id_idx').on(table.categoryId),
]);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  feed: one(feeds, {
    fields: [subscriptions.feedId],
    references: [feeds.id],
  }),
  category: one(categories, {
    fields: [subscriptions.categoryId],
    references: [categories.id],
  }),
}));

// Articles table
// Note: search_tsvector column is managed by raw SQL migration for full-text search
export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  feedId: uuid('feed_id').notNull().references(() => feeds.id, { onDelete: 'cascade' }),
  guid: text('guid').notNull(),
  url: text('url').notNull(),
  title: varchar('title', { length: 1000 }).notNull(),
  summary: text('summary'),
  content: text('content'),
  author: varchar('author', { length: 255 }),
  imageUrl: text('image_url'),
  publishedAt: timestamp('published_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('articles_feed_guid_idx').on(table.feedId, table.guid),
  index('articles_feed_id_idx').on(table.feedId),
  index('articles_published_at_idx').on(table.publishedAt),
]);

export const articlesRelations = relations(articles, ({ one, many }) => ({
  feed: one(feeds, {
    fields: [articles.feedId],
    references: [feeds.id],
  }),
  userArticles: many(userArticles),
}));

// User articles (read/saved state)
export const userArticles = pgTable('user_articles', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  articleId: uuid('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  isRead: boolean('is_read').default(false).notNull(),
  isSaved: boolean('is_saved').default(false).notNull(),
  readAt: timestamp('read_at'),
  savedAt: timestamp('saved_at'),
}, (table) => [
  uniqueIndex('user_articles_pk').on(table.userId, table.articleId),
  index('user_articles_user_id_idx').on(table.userId),
  index('user_articles_is_read_idx').on(table.userId, table.isRead),
  index('user_articles_is_saved_idx').on(table.userId, table.isSaved),
]);

export const userArticlesRelations = relations(userArticles, ({ one }) => ({
  user: one(users, {
    fields: [userArticles.userId],
    references: [users.id],
  }),
  article: one(articles, {
    fields: [userArticles.articleId],
    references: [articles.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Feed = typeof feeds.$inferSelect;
export type NewFeed = typeof feeds.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type UserArticle = typeof userArticles.$inferSelect;
export type NewUserArticle = typeof userArticles.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
