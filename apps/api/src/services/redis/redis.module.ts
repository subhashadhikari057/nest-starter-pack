import { createRedisClient, Redis } from "@bullhouse/redis";
import {
	Global,
	Inject,
	Logger,
	Module,
	OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { REDIS_CLIENT, RedisCacheService } from "./redis.service";

@Global()
@Module({
	providers: [
		{
			provide: REDIS_CLIENT,
			useFactory: (configService: ConfigService) => {
				const redisUrl = configService.getOrThrow<string>("REDIS_URL");
				return createRedisClient(redisUrl);
			},
			inject: [ConfigService],
		},
		RedisCacheService,
	],
	exports: [REDIS_CLIENT, RedisCacheService],
})
export class RedisModule implements OnApplicationShutdown {
	private readonly logger = new Logger(RedisModule.name);

	constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

	async onApplicationShutdown() {
		this.logger.debug("Closing Redis connection...");
		await this.redis.quit();
	}
}
