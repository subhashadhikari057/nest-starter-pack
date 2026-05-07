import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	IsNotEmpty,
	IsString,
	Matches,
	MaxLength,
	MinLength,
} from "class-validator";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export class PhoneRegisterDto {
	@ApiProperty({ example: "John Doe" })
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	name!: string;

	@ApiProperty({ example: "+1234567890" })
	@IsNotEmpty()
	@Transform(({ value }) => {
		const parsed = parsePhoneNumberFromString(value);
		if (!parsed?.isValid()) {
			throw new Error("Please provide a valid phone number.");
		}
		return parsed.number;
	})
	phone!: string;

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
}
