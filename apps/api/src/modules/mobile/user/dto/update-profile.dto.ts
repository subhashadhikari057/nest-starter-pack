import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateProfileDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MinLength(2)
	name?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsEmail()
	email?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	image?: string;
}
