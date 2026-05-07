import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Min,
} from "class-validator";

export class QueryDto {
	@ApiProperty({ required: false, default: true })
	@IsBoolean()
	@Transform(({ value }) => {
		if (value === undefined || value === null || value === "") {
			return true;
		}

		if (typeof value === "boolean") {
			return value;
		}

		return value === "true";
	})
	@IsOptional()
	public readonly pagination?: boolean = true;

	@ApiProperty({ required: false, default: 1, minimum: 1 })
	@IsInt()
	@Min(1)
	@Transform(({ value }) => (value === "" ? undefined : Number(value)))
	@IsOptional()
	public readonly page: number = 1;

	@ApiProperty({ required: false, default: 20, minimum: 1 })
	@IsInt()
	@Min(1)
	@Transform(({ value }) => (value === "" ? undefined : Number(value)))
	@IsOptional()
	public readonly size: number = 20;

	@ApiProperty({ required: false, default: "updatedAt" })
	@IsString()
	@IsOptional()
	public readonly sort: string = "updatedAt";

	@ApiProperty({ required: false, enum: ["asc", "desc"], default: "desc" })
	@IsEnum(["asc", "desc"])
	@IsOptional()
	public readonly order: "asc" | "desc" = "desc";

	@ApiProperty({ required: false })
	@IsString()
	@Transform(({ value }) =>
		typeof value === "string" ? value.trim() : undefined,
	)
	@IsOptional()
	public readonly search?: string;
}
