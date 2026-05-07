import { Module } from "@nestjs/common";
import { RoleGuard } from "@/common/authorization/role.guard";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { TeamController } from "./team.controller";
import { TeamService } from "./team.service";

@Module({
	controllers: [TeamController],
	providers: [TeamService, RoleGuard, JwtAuthGuard],
	exports: [TeamService],
})
export class TeamModule {}
