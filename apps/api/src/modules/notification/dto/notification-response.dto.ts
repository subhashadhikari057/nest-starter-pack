import {
	notificationSurfaceStateValues,
	notificationSurfaceValues,
} from "@bullhouse/mongodb";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class NotificationSurfaceStatusDto {
	@ApiProperty({
		enum: notificationSurfaceStateValues,
	})
	state: (typeof notificationSurfaceStateValues)[number];

	@ApiPropertyOptional()
	deliveredAt?: Date | null;

	@ApiPropertyOptional()
	seenAt?: Date | null;

	@ApiPropertyOptional()
	readAt?: Date | null;

	@ApiPropertyOptional()
	archivedAt?: Date | null;

	@ApiPropertyOptional()
	providerMetadata?: Record<string, unknown> | null;
}

export class NotificationResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	title: string;

	@ApiProperty()
	body: string;

	@ApiPropertyOptional()
	image?: string | null;

	@ApiPropertyOptional()
	data?: Record<string, unknown> | null;

	@ApiProperty({
		enum: ["transactional", "promotional", "system", "personal"],
	})
	type: "transactional" | "promotional" | "system" | "personal";

	@ApiProperty({
		enum: ["high", "normal", "low"],
	})
	priority: "high" | "normal" | "low";

	@ApiProperty({
		enum: notificationSurfaceValues,
		isArray: true,
	})
	surfaces: (typeof notificationSurfaceValues)[number][];

	@ApiProperty({
		type: NotificationSurfaceStatusDto,
	})
	surfaceStatus: NotificationSurfaceStatusDto;

	@ApiProperty()
	createdAt: Date;
}
