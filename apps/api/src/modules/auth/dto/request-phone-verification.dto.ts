import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class RequestPhoneVerificationDto {
	@ApiProperty({ example: "+9779800000000" })
	@IsString()
	@MinLength(6)
	phone!: string;
}
