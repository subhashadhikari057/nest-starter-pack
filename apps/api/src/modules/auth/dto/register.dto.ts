import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	IsEmail,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	MinLength,
	ValidateIf,
	ValidateNested,
} from "class-validator";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { DeviceInfoDto } from "./device-info.dto";

export class RegisterDto {
	@ApiProperty({ example: "John Doe", required: true })
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	name!: string;

	@ApiProperty({ example: "john@example.com" })
	@IsEmail()
	@IsNotEmpty()
	email!: string;

	@ApiProperty({ minLength: 8, maxLength: 32 })
	@IsString()
	@MinLength(8)
	@MaxLength(32)
	@Matches(
		/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[ @$!%*?&#^()[\]{}\-_=+\\|;:'",.<>/]).{8,}$/,
		{
			message:
				"Password must contain uppercase, lowercase, number, and special character.",
		},
	)
	password!: string;

	@ApiProperty({ type: DeviceInfoDto, description: "Device information" })
	@ValidateNested()
	@Type(() => DeviceInfoDto)
	deviceInfo!: DeviceInfoDto;
}
