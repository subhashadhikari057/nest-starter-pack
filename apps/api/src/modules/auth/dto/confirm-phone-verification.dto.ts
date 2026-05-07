import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MinLength } from "class-validator";

export class ConfirmPhoneVerificationDto {
	@ApiProperty({ example: "+9779800000000" })
	@IsString()
	@MinLength(6)
	phone!: string;

	@ApiProperty({ description: "6 digit verification code" })
	@IsString()
	@Matches(/^\d{6}$/)
	otp!: string;
}
