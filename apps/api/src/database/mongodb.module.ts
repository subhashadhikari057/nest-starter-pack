import {
	closeMongoConnection,
	createMongoConnection,
} from "@bullhouse/mongodb";
import { Global, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

export const MONGODB = Symbol("MONGODB");

@Global()
@Module({
	imports: [ConfigModule],
	providers: [
		{
			provide: MONGODB,
			useFactory: async (configService: ConfigService) => {
				const mongoUrl = configService.get<string>("MONGODB_URL");
				if (!mongoUrl) {
					throw new Error("MONGODB_URL is not defined");
				}
				return createMongoConnection(mongoUrl);
			},
			inject: [ConfigService],
		},
	],
	exports: [MONGODB],
})
export class MongoDBModule implements OnModuleDestroy {
	async onModuleDestroy() {
		await closeMongoConnection();
	}
}
