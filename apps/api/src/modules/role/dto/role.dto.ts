import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RoleDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	name: string;

	@ApiProperty({ required: false, nullable: true })
	@IsString()
	@IsOptional()
	description: string | null;

	@ApiProperty()
	isSystemRole: boolean;
}

export class PermissionDto {
	@ApiProperty()
	id: number;
	@ApiProperty()
	module: string;
	@ApiProperty()
	action: string;
	@ApiProperty()
	code: string;
}

export class RoleWithPermissionsDto extends RoleDto {
	@ApiProperty({ type: [PermissionDto] })
	permissions: PermissionDto[];
}

export class FetchRoleDto {
	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	public readonly search?: string;
}
