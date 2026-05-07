import type { RoleName } from "@/common/authorization/role.types";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateUserDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	name?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	phone?: string | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	image?: string | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	role?: RoleName;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MinLength(8)
	password?: string;
}
export class BanUserDto {
	@ApiProperty({ example: "Violation of terms of service" })
	@IsString()
	reason: string;
}
