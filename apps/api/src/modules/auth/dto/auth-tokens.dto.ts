import { ApiProperty } from "@nestjs/swagger";

export class AuthTokensDto {
	@ApiProperty({ example: "session_123" })
	sessionId!: string;

	@ApiProperty({ example: "access_token_jwt" })
	accessToken!: string;

	@ApiProperty({ example: "refresh_token_jwt" })
	refreshToken!: string;
}
