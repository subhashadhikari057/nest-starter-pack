import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	IsBoolean,
	IsEmail,
	IsOptional,
	IsString,
	Matches,
	MinLength,
} from "class-validator";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export class CreateCustomerDto {
	@ApiProperty()
	@IsString()
	name!: string;

	@ApiProperty()
	@IsEmail()
	email!: string;

	@ApiProperty({
		minLength: 8,
		description: "Min 8 chars, must include uppercase, lowercase, and a number",
	})
	@IsString()
	@MinLength(8)
	@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
		message:
			"Password must contain at least one uppercase letter, one lowercase letter, and one number",
	})
	password!: string;

	@ApiPropertyOptional({ example: "+9779800000000" })
	@IsOptional()
	@IsString()
	@Transform(({ value }) => {
		if (!value) return value;
		const parsed = parsePhoneNumberFromString(value);
		if (!parsed?.isValid()) {
			throw new Error("Please provide a valid phone number.");
		}
		return parsed.number;
	})
	phone?: string;

	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	emailVerified?: boolean;

	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	phoneVerified?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	image?: string;
}
