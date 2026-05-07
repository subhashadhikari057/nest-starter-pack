import { notificationSurfaceValues } from "@bullhouse/mongodb";
import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class NotificationSurfaceQueryDto {
	@ApiProperty({
		description: "Notification surface",
		enum: notificationSurfaceValues,
	})
	@IsIn(notificationSurfaceValues)
	surface: (typeof notificationSurfaceValues)[number];
}
