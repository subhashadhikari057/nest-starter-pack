import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, MaxLength, MinLength } from "class-validator";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export class PhoneLoginDto {
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
	@MinLength(8)
	@MaxLength(32)
	password!: string;
}
