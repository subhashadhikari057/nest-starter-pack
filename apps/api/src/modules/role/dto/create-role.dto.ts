import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class CreateRoleDto {
	@ApiProperty()
	@IsString()
	name: string;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	description?: string;

	@ApiProperty({ required: false, default: false })
	@IsBoolean()
	@IsOptional()
	isSystemRole?: boolean;
}
