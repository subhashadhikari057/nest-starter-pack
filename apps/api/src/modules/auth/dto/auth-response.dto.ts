import { ApiProperty } from "@nestjs/swagger";
import { LoginUserDto } from "./public-user.dto";
import { SessionDto } from "./session.dto";

export class AuthResponseDto {
	@ApiProperty({ type: LoginUserDto })
	user!: LoginUserDto;

	@ApiProperty({ type: SessionDto })
	session!: SessionDto;
}
