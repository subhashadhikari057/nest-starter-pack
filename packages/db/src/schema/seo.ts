import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const seo = pgTable(
	"seo",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),

		// General meta
		metaTitle: varchar("meta_title", { length: 120 }).notNull(),
		metaDescription: varchar("meta_description", { length: 500 }).notNull(),
		metaKeywords: varchar("meta_keywords", { length: 180 }).notNull(),
		canonicalUrl: text("canonical_url"),

		// Robots
		robotsIndex: boolean("robots_index").default(true).notNull(),
		robotsFollow: boolean("robots_follow").default(true).notNull(),
		robotsAdvanced: varchar("robots_advanced", { length: 255 }), // e.g. "max-snippet:-1,max-image-preview:large"

		// Open Graph
		ogTitle: varchar("og_title", { length: 255 }),
		ogDescription: varchar("og_description", { length: 500 }),
		ogType: varchar("og_type", { length: 50 }), // "website", "article"
		ogUrl: text("og_url"),
		ogImageUrl: text("og_image_url"),
		ogSiteName: varchar("og_site_name", { length: 120 }),

		// Twitter card
		twitterCard: varchar("twitter_card", { length: 50 }), // "summary", "summary_large_image"
		twitterSite: varchar("twitter_site", { length: 120 }), // @handle
		twitterCreator: varchar("twitter_creator", { length: 120 }),
		twitterTitle: varchar("twitter_title", { length: 255 }),
		twitterDescription: varchar("twitter_description", { length: 500 }),
		twitterImageUrl: text("twitter_image_url"),

		// Optional: hreflang map / alternates
		// Example: { "en": "https://.../en/privacy", "ne": "https://.../ne/privacy" }
		alternates: jsonb("alternates").$type<Record<string, string>>(),

		// Optional: JSON-LD structured data
		// Example: Organization / WebSite schema
		structuredDataJsonLd: jsonb("structured_data_jsonld").$type<
			Record<string, any> | any[]
		>(),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdateFn(() => new Date()),
	},
	(t) => [index("seo_meta_title_idx").on(t.metaTitle)],
);
