import { ApiProperty } from "@nestjs/swagger";

export class UserResponseDto {
	@ApiProperty()
	id!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty()
	email!: string;

	@ApiProperty({ nullable: true, type: String, format: "date-time" })
	emailVerified!: Date | null;

	@ApiProperty({ nullable: true })
	phone!: string | null;

	@ApiProperty({ nullable: true, type: String, format: "date-time" })
	phoneVerified!: Date | null;

	@ApiProperty({ nullable: true })
	image!: string | null;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;

	@ApiProperty({ default: false })
	banned!: boolean;

	@ApiProperty({ nullable: true, required: false })
	banReason!: string | null;
}
