import type { Redis } from "@bullhouse/redis";

import {
	Controller,
	Get,
	Inject,
	ServiceUnavailableException,
} from "@nestjs/common";
import { Public } from "@/modules/auth/decorators/public.decorator";
import { REDIS_CLIENT } from "@/services/redis/redis.service";
import { RealtimeService } from "./realtime.service";

@Public()
@Controller("health")
export class RealtimeHealthController {
	constructor(
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
		private readonly realtimeService: RealtimeService,
	) {}

	@Get("realtime")
	async getRealtimeHealth() {
		const socketReady = this.realtimeService.isInitialized();
		let redisOk = false;
		try {
			const pong = await this.redis.ping();
			redisOk = pong === "PONG";
		} catch {
			redisOk = false;
		}

		if (!socketReady || !redisOk) {
			throw new ServiceUnavailableException({
				socketReady,
				redisOk,
			});
		}

		return {
			status: "ok",
			socketReady,
			redisOk,
		};
	}
}
