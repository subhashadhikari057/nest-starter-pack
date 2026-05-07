import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	IsDateString,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Max,
	Min,
} from "class-validator";
import { QueryDto } from "@/common/dto/query.dto";

export class ActivityUserSummaryDto {
	@ApiProperty({ description: "User id", format: "uuid", nullable: true })
	id!: string | null;

	@ApiProperty({ description: "User name", nullable: true })
	name!: string | null;

	@ApiProperty({ description: "User role name", nullable: true })
	role!: string | null;
}

export class ActivityListItemDto {
	@ApiProperty({ description: "Activity log ID (MongoDB ObjectId)" })
	id!: string;

	@ApiProperty({ description: "User who performed the action" })
	user!: ActivityUserSummaryDto;

	@ApiProperty({
		description: "Action performed (e.g., product.create, product.update)",
	})
	action!: string;

	@ApiProperty({ description: "Module affected (e.g., products, orders)" })
	module!: string;

	@ApiProperty({ description: "Status of the action" })
	status!: string;

	@ApiProperty({ description: "Resource ID affected", nullable: true })
	resourceId!: string | null;

	@ApiProperty({ description: "Resource type affected", nullable: true })
	resourceType!: string | null;

	@ApiProperty({ description: "Timestamp when action occurred" })
	timestamp!: Date;

	@ApiProperty({ description: "IP address of the user", nullable: true })
	ipAddress!: string | null;

	@ApiProperty({ description: "User agent string", nullable: true })
	userAgent!: string | null;
}

export class ActivityChangeDto {
	@ApiProperty({ description: "Field that changed" })
	field!: string;

	@ApiProperty({ description: "Previous value", nullable: true })
	from?: unknown;

	@ApiProperty({ description: "New value", nullable: true })
	to?: unknown;
}

export class ActivityDetailDto extends ActivityListItemDto {
	@ApiProperty({
		description: "Structured list of field-level changes",
		type: [ActivityChangeDto],
	})
	changes!: ActivityChangeDto[];

	@ApiProperty({ description: "Reason for the action", nullable: true })
	reason!: string | null;

	@ApiProperty({ description: "Additional metadata", nullable: true })
	metadata!: Record<string, unknown> | null;

	@ApiProperty({ description: "HTTP endpoint", nullable: true })
	endpoint!: string | null;

	@ApiProperty({ description: "HTTP method (GET, POST, etc.)", nullable: true })
	method!: string | null;

	@ApiProperty({ description: "HTTP status code", nullable: true })
	statusCode!: number | null;

	@ApiProperty({ description: "Duration in milliseconds", nullable: true })
	duration!: number | null;

	@ApiProperty({ description: "Error code if action failed", nullable: true })
	errorCode!: string | null;

	@ApiProperty({
		description: "Error message if action failed",
		nullable: true,
	})
	errorMessage!: string | null;
}

export class ActivityListQueryDto extends QueryDto {
	@ApiProperty({
		required: false,
		enum: [
			"products",
			"orders",
			"inventory",
			"customers",
			"users",
			"discounts",
			"settings",
			"categories",
			"reports",
			"payments",
			"shipping",
			"analytics",
			"suppliers",
			"content",
			"subscriptions",
		],
	})
	@IsEnum([
		"products",
		"orders",
		"inventory",
		"customers",
		"users",
		"discounts",
		"settings",
		"categories",
		"reports",
		"payments",
		"shipping",
		"analytics",
		"suppliers",
		"content",
		"subscriptions",
	])
	@IsOptional()
	@Type(() => String)
	public readonly module?: string;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	public readonly action?: string;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	public readonly userId?: string;
}

export class ActivityAnalyticsQueryDto {
	@ApiProperty({
		required: false,
		description:
			"If startDate/endDate are not provided, query uses this many trailing days.",
		default: 30,
		minimum: 1,
		maximum: 365,
	})
	@IsInt()
	@Min(1)
	@Max(365)
	@Transform(({ value }) => (value === "" ? undefined : Number(value)))
	@IsOptional()
	public readonly days?: number = 30;

	@ApiProperty({ required: false, description: "ISO start date/time (UTC)." })
	@IsDateString()
	@IsOptional()
	public readonly startDate?: string;

	@ApiProperty({ required: false, description: "ISO end date/time (UTC)." })
	@IsDateString()
	@IsOptional()
	public readonly endDate?: string;

	@ApiProperty({
		required: false,
		enum: [
			"products",
			"orders",
			"inventory",
			"customers",
			"users",
			"discounts",
			"settings",
			"categories",
			"reports",
			"payments",
			"shipping",
			"analytics",
			"suppliers",
			"content",
			"subscriptions",
		],
	})
	@IsEnum([
		"products",
		"orders",
		"inventory",
		"customers",
		"users",
		"discounts",
		"settings",
		"categories",
		"reports",
		"payments",
		"shipping",
		"analytics",
		"suppliers",
		"content",
		"subscriptions",
	])
	@IsOptional()
	@Type(() => String)
	public readonly module?: string;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	public readonly action?: string;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	public readonly userId?: string;
}

export class ActivityAnalyticsBucketDto {
	@ApiProperty({ description: "Bucket key (e.g. date/module/action/status)." })
	key!: string;

	@ApiProperty({ description: "Count for this bucket." })
	count!: number;
}

export class ActivityAnalyticsOverviewDto {
	@ApiProperty()
	startDate!: Date;

	@ApiProperty()
	endDate!: Date;

	@ApiProperty()
	total!: number;

	@ApiProperty()
	success!: number;

	@ApiProperty()
	failure!: number;

	@ApiProperty()
	pending!: number;

	@ApiProperty()
	partial!: number;

	@ApiProperty()
	uniqueUsers!: number;

	@ApiProperty()
	uniqueActions!: number;

	@ApiProperty()
	uniqueModules!: number;

	@ApiProperty({ type: [ActivityAnalyticsBucketDto] })
	byDay!: ActivityAnalyticsBucketDto[];

	@ApiProperty({ type: [ActivityAnalyticsBucketDto] })
	byModule!: ActivityAnalyticsBucketDto[];

	@ApiProperty({ type: [ActivityAnalyticsBucketDto] })
	byAction!: ActivityAnalyticsBucketDto[];

	@ApiProperty({ type: [ActivityAnalyticsBucketDto] })
	byStatus!: ActivityAnalyticsBucketDto[];
}
