import type { RoleName } from "../../../common/authorization/role.types";

import { ApiProperty } from "@nestjs/swagger";

export class BaseUserDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty()
	email!: string;

	@ApiProperty({ nullable: true, required: false })
	image!: string | null;

	@ApiProperty({ nullable: true, type: String, format: "date-time" })
	emailVerified!: Date | null;

	@ApiProperty({ nullable: true, required: false })
	phone!: string | null;

	@ApiProperty({ nullable: true, type: String, format: "date-time" })
	phoneVerified!: Date | null;

	@ApiProperty({ nullable: true })
	roleId!: number | null;

	@ApiProperty({
		nullable: true,
		required: false,
	})
	role!: RoleName | null;
}

export class LoginUserDto extends BaseUserDto {}

export class ProfileUserDto extends BaseUserDto {}
