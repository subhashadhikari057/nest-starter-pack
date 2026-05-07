import { ApiProperty } from "@nestjs/swagger";
import {
	IsEmail,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	MinLength,
	ValidateIf,
} from "class-validator";

export class ResetPasswordDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@ValidateIf((dto) => !dto.otp)
	token?: string;

	@ApiProperty({ required: false, description: "6 digit one-time code" })
	@IsOptional()
	@IsString()
	@Matches(/^\d{6}$/)
	@ValidateIf((dto) => !dto.token)
	otp?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsEmail()
	@ValidateIf((dto) => Boolean(dto.otp) && !dto.token)
	email?: string;

	@ApiProperty({ minLength: 8, maxLength: 32 })
	@MinLength(8)
	@MaxLength(32)
	password!: string;
}
