import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Permissions } from "@/common/authorization/permissions.decorator";
import { RoleGuard } from "@/common/authorization/role.guard";
import { ResponseDto } from "@/common/dto/response-dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsService } from "./permissions.service";

@ApiTags("Permissions")
@ApiBearerAuth()
@Controller("permissions")
@UseGuards(JwtAuthGuard, RoleGuard)
export class PermissionsController {
	constructor(private readonly permissionsService: PermissionsService) {}

	@Get()
	@Permissions("Permissions_READ")
	@ApiOperation({ summary: "List all available permissions" })
	async findAll() {
		const permissions = await this.permissionsService.findAll();
		return new ResponseDto("Permissions fetched successfully", permissions);
	}
}
