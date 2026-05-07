import { ApiProperty } from "@nestjs/swagger";
import {
	IsEmail,
	IsOptional,
	IsString,
	Matches,
	ValidateIf,
} from "class-validator";

export class ConfirmEmailVerificationDto {
	@ApiProperty({
		required: false,
		description: "Token from the verification link",
	})
	@IsOptional()
	@IsString()
	@ValidateIf((dto) => !dto.otp)
	token?: string;

	@ApiProperty({
		required: false,
		description: "6-digit OTP from the verification email",
	})
	@IsOptional()
	@IsString()
	@Matches(/^\d{6}$/)
	@ValidateIf((dto) => !dto.token)
	otp?: string;

	@ApiProperty({
		required: false,
		description: "Required when verifying via OTP",
	})
	@IsOptional()
	@IsEmail()
	@ValidateIf((dto) => Boolean(dto.otp) && !dto.token)
	email?: string;
}
