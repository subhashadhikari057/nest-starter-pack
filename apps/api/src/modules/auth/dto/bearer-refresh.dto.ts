import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class BearerRefreshDto {
	@ApiProperty()
	@IsNotEmpty()
	@IsString()
	refreshToken!: string;

	@ApiProperty()
	@IsNotEmpty()
	@IsString()
	sessionId!: string;
}
