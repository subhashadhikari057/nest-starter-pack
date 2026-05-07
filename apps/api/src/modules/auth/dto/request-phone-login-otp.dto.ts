import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export class RequestPhoneLoginOtpDto {
	@ApiProperty({ example: "+9779800000000" })
	@IsNotEmpty()
	@IsString()
	@Transform(({ value }) => {
		const parsed = parsePhoneNumberFromString(value);
		if (!parsed?.isValid()) {
			throw new Error("Please provide a valid phone number.");
		}
		return parsed.number;
	})
	phone!: string;
}
