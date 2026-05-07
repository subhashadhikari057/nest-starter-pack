import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsOptional,
	IsString,
	Matches,
	MinLength,
	ValidateIf,
} from "class-validator";

const STRONG_PASSWORD_REGEX =
	/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[ @$!%*?&#^()[\]{}\-_=+\\|;:'",.<>/]).{8,}$/;

export class SetPasswordDto {
	@ApiPropertyOptional({
		description: "Required if you already have a password on this account.",
	})
	@IsOptional()
	@IsString()
	@ValidateIf((dto) => Boolean(dto.currentPassword))
	currentPassword?: string;

	@ApiProperty({
		description:
			"Must be at least 8 characters and include upper, lower, number, and symbol.",
		minLength: 8,
	})
	@IsString()
	@MinLength(8)
	@Matches(STRONG_PASSWORD_REGEX, {
		message:
			"Password must contain uppercase, lowercase, number, and special character.",
	})
	newPassword!: string;
}
