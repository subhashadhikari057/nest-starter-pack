import type { Redis } from "@bullhouse/redis";

import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import { Permissions } from "@/common/authorization/permissions.decorator";
import { RoleGuard } from "@/common/authorization/role.guard";
import {
	ApiPaginatedResponseDto,
	ApiResponseDto,
	ResponseDto,
} from "@/common/dto/response-dto";
import { PaginationUtil } from "@/common/utils/pagination.util";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { REDIS_CLIENT } from "@/services/redis/redis.service";
import { FetchUserDto } from "../dto/fetch-user.dto";
import { CreateTeamMemberDto } from "./dto/create-team-member.dto";
import {
	TeamMemberCreatedResponseDto,
	TeamMemberResponseDto,
} from "./dto/team-member-response.dto";
import {
	BanTeamMemberDto,
	UpdateTeamMemberDto,
} from "./dto/update-team-member.dto";
import { TeamService } from "./team.service";

@ApiTags("Team")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller("users/team")
export class TeamController {
	constructor(
		private readonly teamService: TeamService,
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
	) {}

	@Get()
	@ApiOperation({ summary: "List all team members" })
	@ApiPaginatedResponseDto(TeamMemberResponseDto)
	@Permissions("Users_READ")
	async findAll(@Query() query: FetchUserDto) {
		const { members, totalCount, page, size, pagination } =
			await this.teamService.findAll(query);
		return new ResponseDto<TeamMemberResponseDto[]>(
			"Team members fetched successfully",
			members,
			pagination && PaginationUtil.buildMetadata(totalCount, page, size),
		);
	}

	@Get(":id")
	@ApiOperation({ summary: "Get a single team member by id" })
	@ApiResponseDto(TeamMemberResponseDto)
	@Permissions("Users_READ")
	async findOne(@Param("id", ParseUUIDPipe) id: string) {
		const member = await this.teamService.findById(id);
		return new ResponseDto<TeamMemberResponseDto>(
			"Team member fetched successfully",
			member,
		);
	}

	@Post()
	@ApiOperation({ summary: "Create a new team member" })
	@ApiCreatedResponse({ description: "Team member created successfully" })
	@Permissions("Users_CREATE")
	async create(@Body() createTeamMemberDto: CreateTeamMemberDto) {
		const member = await this.teamService.create(createTeamMemberDto);
		await this.clearCache(member.id);
		return new ResponseDto<TeamMemberCreatedResponseDto>(
			"Team member created successfully",
			member,
		);
	}

	@Patch(":id")
	@ApiOperation({ summary: "Update an existing team member" })
	@ApiResponseDto(TeamMemberResponseDto)
	@Permissions("Users_UPDATE")
	async update(
		@Param("id", ParseUUIDPipe) id: string,
		@Body() updateTeamMemberDto: UpdateTeamMemberDto,
	) {
		const member = await this.teamService.update(id, updateTeamMemberDto);
		await this.clearCache(id);
		return new ResponseDto<TeamMemberResponseDto>(
			"Team member updated successfully",
			member,
		);
	}

	@Patch(":id/ban")
	@ApiOperation({ summary: "Ban a team member" })
	@ApiOkResponse({ schema: { properties: { success: { type: "boolean" } } } })
	@Permissions("Users_UPDATE")
	async ban(
		@Param("id", ParseUUIDPipe) id: string,
		@Body() banTeamMemberDto: BanTeamMemberDto,
	) {
		await this.teamService.ban(id, banTeamMemberDto);
		await this.clearCache(id);
		return { success: true };
	}

	private async clearCache(memberId?: string) {
		if (!memberId) return;
		await this.redis.del([`session:${memberId}`]);
	}
}
