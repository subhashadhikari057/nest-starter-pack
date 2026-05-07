import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsString, ValidateNested } from "class-validator";
import { DeviceInfoDto } from "@/modules/auth/dto/device-info.dto";

export class MobileRefreshDto {
	@ApiProperty()
	@IsNotEmpty()
	@IsString()
	refreshToken!: string;

	@ApiProperty()
	@IsNotEmpty()
	@IsString()
	sessionId!: string;

	@ApiProperty({ type: DeviceInfoDto, description: "Device information" })
	@ValidateNested()
	@Type(() => DeviceInfoDto)
	deviceInfo!: DeviceInfoDto;
}
