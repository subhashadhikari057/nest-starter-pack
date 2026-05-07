import { ApiProperty } from "@nestjs/swagger";

export class SessionDto {
	@ApiProperty()
	sessionId!: string;

	@ApiProperty()
	accessTokenExpiresAt!: Date;

	@ApiProperty()
	refreshTokenExpiresAt!: Date;
}
