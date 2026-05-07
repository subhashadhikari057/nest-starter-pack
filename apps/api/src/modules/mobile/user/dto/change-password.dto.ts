import { ApiProperty } from "@nestjs/swagger";
import {
	IsNotEmpty,
	IsString,
	Matches,
	MaxLength,
	MinLength,
} from "class-validator";

export class ChangePasswordDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	currentPassword!: string;

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
	newPassword!: string;
}
