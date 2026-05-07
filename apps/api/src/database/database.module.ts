import { createDatabase, type Database } from "@bullhouse/db";
import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { sql } from "drizzle-orm";

export const DATABASE = Symbol("DATABASE");

@Global()
@Module({
	imports: [ConfigModule],
	providers: [
		{
			provide: DATABASE,
			useFactory: async (configService: ConfigService) => {
				const databaseUrl = configService.getOrThrow<string>("DATABASE_URL");
				const db = createDatabase(databaseUrl);
				try {
					await db.execute(sql`select 1`);
				} catch (error) {
					throw error;
				}
				return db;
			},
			inject: [ConfigService],
		},
	],
	exports: [DATABASE],
})
export class DatabaseModule {}

export type { Database };
