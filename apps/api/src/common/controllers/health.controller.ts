import { Controller, Get } from "@nestjs/common";
import { Public } from "@/modules/auth/decorators/public.decorator";

@Public()
@Controller("health")
export class HealthController {
	@Get()
	health() {
		return {
			status: "ok",
			timestamp: new Date().toISOString(),
		};
	}
}
