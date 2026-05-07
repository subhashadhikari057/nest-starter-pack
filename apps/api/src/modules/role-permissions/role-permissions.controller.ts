import {
	Body,
	Controller,
	Param,
	ParseIntPipe,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Permissions } from "@/common/authorization/permissions.decorator";
import { RoleGuard } from "@/common/authorization/role.guard";
import { ResponseDto } from "@/common/dto/response-dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RoleWithPermissionsDto } from "../role/dto";
import { AssignPermissionsDto } from "./dto";
import { RolePermissionsService } from "./role-permissions.service";

@ApiTags("Role-Permissions")
@ApiBearerAuth()
@Controller("roles/:roleId/permissions")
@UseGuards(JwtAuthGuard, RoleGuard)
export class RolePermissionsController {
	constructor(
		private readonly rolePermissionsService: RolePermissionsService,
	) {}

	@Post()
	@Permissions("Roles_UPDATE") // Or a more specific 'RolePermissions_UPDATE'
	@ApiOperation({ summary: "Assign permissions to a role" })
	async assignPermissions(
		@Param("roleId", ParseIntPipe) roleId: number,
		@Body() assignPermissionsDto: AssignPermissionsDto,
	) {
		const role = await this.rolePermissionsService.assignPermissionsToRole(
			roleId,
			assignPermissionsDto,
		);
		return new ResponseDto<RoleWithPermissionsDto>(
			"Permissions assigned to role successfully",
			role,
		);
	}
}
