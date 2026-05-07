import { applyDecorators, Type } from "@nestjs/common";
import {
	ApiExtraModels,
	ApiOkResponse,
	ApiProperty,
	ApiPropertyOptional,
	getSchemaPath,
} from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ResponseDto<T = unknown> {
	@ApiProperty()
	readonly message!: string;

	@ApiPropertyOptional()
	readonly data?: T;

	@ApiPropertyOptional()
	readonly count?: number;

	@ApiPropertyOptional()
	readonly currentPage?: number;

	@ApiPropertyOptional()
	readonly totalPage?: number;

	@ApiPropertyOptional()
	readonly nextCursor?: string | null;

	// @ApiPropertyOptional({ nullable: true, default: null })
	// readonly errorCode?: string | null;

	constructor(
		message: string,
		data?: T,
		pagination?: {
			count?: number;
			page?: number;
			size?: number;
			nextCursor?: string | null;
		},
	) {
		this.message = message;
		this.data = data;
		// this.errorCode = null;

		if (pagination) {
			if (
				typeof pagination.count === "number" &&
				typeof pagination.page === "number" &&
				typeof pagination.size === "number"
			) {
				this.count = pagination.count;
				this.currentPage = pagination.page;
				this.totalPage = Math.ceil(pagination.count / pagination.size);
			}
			if (Object.hasOwn(pagination, "nextCursor")) {
				this.nextCursor = pagination.nextCursor ?? null;
			}
		}
	}
}

/**
 * Custom decorator for API responses with ResponseDto
 * Properly documents the response schema in Swagger/OpenAPI
 */
export const ApiResponseDto = <DataDto extends Type<unknown>>(
	dataDto: DataDto,
	options?: { isArray?: boolean },
) =>
	applyDecorators(
		ApiExtraModels(ResponseDto, dataDto),
		ApiOkResponse({
			schema: {
				type: "object",
				properties: {
					message: {
						type: "string",
					},
					// errorCode: {
					// 	type: "string",
					// 	nullable: true,
					// 	default: null,
					// },
					data: options?.isArray
						? {
								type: "array",
								items: { $ref: getSchemaPath(dataDto) },
							}
						: {
								$ref: getSchemaPath(dataDto),
							},
				},
				required: ["message"],
			},
		}),
	);

/**
 * Custom decorator for paginated API responses with ResponseDto
 * Properly documents the paginated response schema in Swagger/OpenAPI
 */
export const ApiPaginatedResponseDto = <DataDto extends Type<unknown>>(
	dataDto: DataDto,
) =>
	applyDecorators(
		ApiExtraModels(ResponseDto, dataDto),
		ApiOkResponse({
			schema: {
				type: "object",
				properties: {
					message: {
						type: "string",
					},
					// errorCode: {
					// 	type: "string",
					// 	nullable: true,
					// 	default: null,
					// },
					data: {
						type: "array",
						items: { $ref: getSchemaPath(dataDto) },
					},
					count: {
						type: "number",
					},
					currentPage: {
						type: "number",
					},
					totalPage: {
						type: "number",
					},
				},
				required: ["message"],
			},
		}),
	);

export class DateDTO {
	@ApiProperty({
		description: "Created Date",
		example: "2025-11-21T18:03:48.926Z",
	})
	@IsOptional()
	@IsString()
	createdAt: Date;

	@ApiProperty({
		description: "Last Updated Date",
		example: "2025-11-21T18:03:48.926Z",
	})
	@IsOptional()
	@IsString()
	updatedAt: Date;
}
