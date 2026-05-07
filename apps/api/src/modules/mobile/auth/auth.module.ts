import { Module } from "@nestjs/common";
import { IpThrottlerGuard } from "@/common/guards/ip-throttler.guard";
import { AuthModule as SharedAuthModule } from "@/modules/auth/auth.module";
import { RoleModule } from "@/modules/role/role.module";
import { AuthController } from "./auth.controller";

@Module({
	imports: [SharedAuthModule, RoleModule],
	controllers: [AuthController],
	providers: [IpThrottlerGuard],
})
export class AuthModule {}
