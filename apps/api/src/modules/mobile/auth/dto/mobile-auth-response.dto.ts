import { ApiProperty } from "@nestjs/swagger";
import { AuthTokensDto } from "@/modules/auth/dto/auth-tokens.dto";
import { ProfileUserDto } from "@/modules/auth/dto/public-user.dto";

export class MobileAuthResponseDto {
	@ApiProperty({ type: ProfileUserDto })
	user!: ProfileUserDto;

	@ApiProperty({ type: AuthTokensDto })
	tokens!: AuthTokensDto;
}
