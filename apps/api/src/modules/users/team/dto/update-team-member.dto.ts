import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdateTeamMemberDto {
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

	@ApiPropertyOptional({ description: "Role ID to assign to the team member" })
	@IsOptional()
	@IsInt()
	@Min(1)
	roleId?: number | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MinLength(8)
	password?: string;
}

export class BanTeamMemberDto {
	@ApiProperty({ example: "Violation of terms of service" })
	@IsString()
	reason: string;
}
