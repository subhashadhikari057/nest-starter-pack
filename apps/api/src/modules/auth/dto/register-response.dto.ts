import { ApiProperty } from "@nestjs/swagger";
import { LoginUserDto } from "./public-user.dto";

export class RegisterResponseDto {
	@ApiProperty({ type: LoginUserDto })
	user!: LoginUserDto;
}
