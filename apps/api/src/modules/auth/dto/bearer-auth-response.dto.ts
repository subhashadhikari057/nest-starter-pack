import { ApiProperty } from "@nestjs/swagger";
import { AuthTokensDto } from "./auth-tokens.dto";
import { ProfileUserDto } from "./public-user.dto";

export class BearerAuthResponseDto {
	@ApiProperty({ type: ProfileUserDto })
	user!: ProfileUserDto;

	@ApiProperty({ type: AuthTokensDto })
	tokens!: AuthTokensDto;
}
