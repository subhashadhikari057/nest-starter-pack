import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsEmail,
	IsNotEmpty,
	MaxLength,
	MinLength,
	ValidateNested,
} from "class-validator";
import { DeviceInfoDto } from "@/modules/auth/dto/device-info.dto";

export class MobileEmailLoginDto {
	@ApiProperty({ example: "john@example.com" })
	@IsEmail()
	@IsNotEmpty()
	email!: string;

	@ApiProperty({ minLength: 8, maxLength: 32 })
	@MinLength(8)
	@MaxLength(32)
	password!: string;

	@ApiProperty({ type: DeviceInfoDto, description: "Device information" })
	@ValidateNested()
	@Type(() => DeviceInfoDto)
	deviceInfo!: DeviceInfoDto;
}
