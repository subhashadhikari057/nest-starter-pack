import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SyncMobilePushTokenResponseDto {
	@ApiProperty()
	deviceId!: string;

	@ApiProperty()
	deviceType!: string;

	@ApiPropertyOptional()
	deviceName?: string | null;

	@ApiProperty()
	hasPushToken!: boolean;

	@ApiProperty()
	isActive!: boolean;

	@ApiProperty()
	updatedAt!: Date;
}
