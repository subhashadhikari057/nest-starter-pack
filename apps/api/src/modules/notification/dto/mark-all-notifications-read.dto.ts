import { notificationSurfaceValues } from "@bullhouse/mongodb";
import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

export class MarkAllNotificationsReadDto {
	@ApiProperty({
		description: "Notification surface",
		enum: notificationSurfaceValues,
	})
	@IsIn(notificationSurfaceValues)
	surface: (typeof notificationSurfaceValues)[number];

	@ApiProperty({
		description: "Origin websocket session id for self-update dedup",
		required: false,
	})
	@IsOptional()
	@IsString()
	originSessionId?: string;
}
