import { notificationSurfaceValues } from "@bullhouse/mongodb";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsOptional } from "class-validator";
import { QueryDto } from "@/common/dto/query.dto";

export class NotificationListQueryDto extends QueryDto {
	@ApiProperty({
		description: "Notification surface",
		enum: notificationSurfaceValues,
	})
	@IsIn(notificationSurfaceValues)
	surface: (typeof notificationSurfaceValues)[number];

	@ApiPropertyOptional({
		description: "Cursor for cursor-based pagination",
	})
	@IsOptional()
	@Transform(({ value }) => {
		if (value === undefined || value === null || value === "") {
			return undefined;
		}
		return String(value);
	})
	cursor?: string;
}
