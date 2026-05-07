import {
	Controller,
	Get,
	NotFoundException,
	Param,
	Query,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Permissions } from "@/common/authorization/permissions.decorator";
import { RoleGuard } from "@/common/authorization/role.guard";
import {
	ApiPaginatedResponseDto,
	ApiResponseDto,
	ResponseDto,
} from "@/common/dto/response-dto";
import { PaginationUtil } from "@/common/utils/pagination.util";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { ActivityService } from "./activity.service";
import {
	ActivityAnalyticsOverviewDto,
	ActivityAnalyticsQueryDto,
	ActivityDetailDto,
	ActivityListItemDto,
	ActivityListQueryDto,
} from "./dto";

@ApiTags("Activity")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller("activity")
export class ActivityController {
	constructor(private readonly activityService: ActivityService) {}

	@Get()
	@ApiOperation({ summary: "List all activity logs" })
	@ApiPaginatedResponseDto(ActivityListItemDto)
	@Permissions("Activity_READ")
	async findAll(@Query() query: ActivityListQueryDto) {
		const { data, totalCount } = await this.activityService.findAll(query);
		const metadata = query.pagination
			? PaginationUtil.buildMetadata(totalCount, query.page, query.size)
			: undefined;

		return new ResponseDto("Activities fetched successfully", data, metadata);
	}

	@Get("analytics/overview")
	@ApiOperation({ summary: "Get activity analytics overview" })
	@ApiResponseDto(ActivityAnalyticsOverviewDto)
	@Permissions("Activity_READ")
	async getAnalyticsOverview(@Query() query: ActivityAnalyticsQueryDto) {
		const data = await this.activityService.getAnalyticsOverview(query);
		return new ResponseDto("Activity analytics fetched successfully", data);
	}

	@Get(":id")
	@ApiOperation({ summary: "Get a single activity log by id" })
	@ApiResponseDto(ActivityDetailDto)
	@Permissions("Activity_READ")
	async findOne(@Param("id") id: string) {
		const activity = await this.activityService.findById(id);
		if (!activity) {
			throw new NotFoundException("Activity not found");
		}
		return new ResponseDto("Activity fetched successfully", activity);
	}
}
