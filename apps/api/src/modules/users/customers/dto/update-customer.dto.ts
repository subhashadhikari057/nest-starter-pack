import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateCustomerDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	name?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	phone?: string | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	image?: string | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MinLength(8)
	password?: string;
}

export class BanCustomerDto {
	@ApiProperty({ example: "Violation of terms of service" })
	@IsString()
	reason: string;
}
