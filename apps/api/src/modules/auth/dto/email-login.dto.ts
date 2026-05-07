import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, MaxLength, MinLength } from "class-validator";

export class EmailLoginDto {
	@ApiProperty({ example: "john@doe.com" })
	@IsEmail()
	email!: string;

	@ApiProperty({ minLength: 8, maxLength: 32 })
	@MinLength(8)
	@MaxLength(32)
	password!: string;
}
