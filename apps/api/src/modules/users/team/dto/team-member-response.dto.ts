import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TeamMemberResponseDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty({ nullable: true })
	email!: string | null;

	@ApiProperty({ nullable: true, type: String, format: "date-time" })
	emailVerified!: Date | null;

	@ApiProperty({ nullable: true })
	phone!: string | null;

	@ApiProperty({ nullable: true, type: String, format: "date-time" })
	phoneVerified!: Date | null;

	@ApiProperty({ nullable: true })
	image!: string | null;

	@ApiPropertyOptional({ nullable: true })
	roleId!: number | null;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;

	@ApiProperty({ default: false })
	banned!: boolean;

	@ApiProperty({ nullable: true, required: false })
	banReason!: string | null;
}

export class TeamMemberCreatedResponseDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty()
	roleName!: string;
}
