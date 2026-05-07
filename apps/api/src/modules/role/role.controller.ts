import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Permissions } from "@/common/authorization/permissions.decorator";
import { RoleGuard } from "@/common/authorization/role.guard";
import { QueryDto } from "@/common/dto/query.dto";
import {
	ApiPaginatedResponseDto,
	ResponseDto,
} from "@/common/dto/response-dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
	CreateRoleDto,
	FetchRoleDto,
	RoleDto,
	RoleWithPermissionsDto,
	UpdateRoleDto,
} from "./dto";
import { RoleService } from "./role.service";

@ApiTags("Roles")
@ApiBearerAuth()
@Controller("roles")
@UseGuards(JwtAuthGuard, RoleGuard)
export class RoleController {
	constructor(private readonly roleService: RoleService) {}

	@Post()
	@Permissions("Roles_CREATE")
	@ApiOperation({ summary: "Create a new role" })
	async create(@Body() createRoleDto: CreateRoleDto) {
		const role = await this.roleService.create(createRoleDto);
		return new ResponseDto<RoleDto>("Role created successfully", role);
	}

	@Get()
	@Permissions("Roles_READ")
	@ApiOperation({ summary: "List all roles" })
	@ApiPaginatedResponseDto(RoleDto)
	async findAll(@Query() query: FetchRoleDto) {
		const roles = await this.roleService.findAll(query);
		return new ResponseDto<RoleDto[]>(
			"Roles fetched successfully",
			roles.roles,
		);
	}

	@Get(":id")
	@Permissions("Roles_READ")
	@ApiOperation({ summary: "Get a single role with its permissions" })
	async findOne(@Param("id", ParseIntPipe) id: number) {
		const role = await this.roleService.findOne(id);
		return new ResponseDto<RoleWithPermissionsDto>(
			"Role fetched successfully",
			role,
		);
	}

	@Patch(":id")
	@Permissions("Roles_UPDATE")
	@ApiOperation({ summary: "Update a role" })
	async update(
		@Param("id", ParseIntPipe) id: number,
		@Body() updateRoleDto: UpdateRoleDto,
	) {
		const role = await this.roleService.update(id, updateRoleDto);
		return new ResponseDto<RoleDto>("Role updated successfully", role);
	}

	@Delete(":id")
	@Permissions("Roles_DELETE")
	@ApiOperation({ summary: "Delete a role" })
	async remove(@Param("id", ParseIntPipe) id: number) {
		await this.roleService.remove(id);
		return new ResponseDto("Role deleted successfully");
	}
}
