import type { Redis } from "@bullhouse/redis";

import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import { Permissions } from "@/common/authorization/permissions.decorator";
import { RoleGuard } from "@/common/authorization/role.guard";
import {
	ApiPaginatedResponseDto,
	ApiResponseDto,
	ResponseDto,
} from "@/common/dto/response-dto";
import { PaginationUtil } from "@/common/utils/pagination.util";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { REDIS_CLIENT } from "@/services/redis/redis.service";
import { FetchUserDto } from "../dto/fetch-user.dto";
import { UserResponseDto } from "../dto/user-response.dto";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { BanCustomerDto, UpdateCustomerDto } from "./dto/update-customer.dto";

@ApiTags("Customers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller("users/customers")
export class CustomersController {
	constructor(
		private readonly customersService: CustomersService,
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
	) {}

	@Get()
	@ApiOperation({ summary: "List all customers" })
	@ApiPaginatedResponseDto(UserResponseDto)
	@Permissions("Users_READ")
	async findAll(@Query() query: FetchUserDto) {
		const { users, totalCount, page, size, pagination } =
			await this.customersService.findAll(query);
		return new ResponseDto<UserResponseDto[]>(
			"Customers fetched successfully",
			users,
			pagination && PaginationUtil.buildMetadata(totalCount, page, size),
		);
	}

	@Get(":id")
	@ApiOperation({ summary: "Get a single customer by id" })
	@ApiResponseDto(UserResponseDto)
	@Permissions("Users_READ")
	async findOne(@Param("id", ParseUUIDPipe) id: string) {
		const user = await this.customersService.findById(id);
		return new ResponseDto<UserResponseDto>(
			"Customer fetched successfully",
			user,
		);
	}

	@Post()
	@ApiOperation({ summary: "Create a new customer" })
	@ApiCreatedResponse({ description: "Customer created successfully" })
	@Permissions("Users_CREATE")
	async create(@Body() createCustomerDto: CreateCustomerDto) {
		const user = await this.customersService.create(createCustomerDto);
		await this.clearCache(user.id);
		return new ResponseDto<UserResponseDto>(
			"Customer created successfully",
			user,
		);
	}

	@Patch(":id")
	@ApiOperation({ summary: "Update an existing customer" })
	@ApiResponseDto(UserResponseDto)
	@Permissions("Users_UPDATE")
	async update(
		@Param("id", ParseUUIDPipe) id: string,
		@Body() updateCustomerDto: UpdateCustomerDto,
	) {
		const user = await this.customersService.update(id, updateCustomerDto);
		await this.clearCache(id);
		return new ResponseDto<UserResponseDto>(
			"Customer updated successfully",
			user,
		);
	}

	@Patch(":id/ban")
	@ApiOperation({ summary: "Ban a customer" })
	@ApiOkResponse({ schema: { properties: { success: { type: "boolean" } } } })
	@Permissions("Users_UPDATE")
	async ban(
		@Param("id", ParseUUIDPipe) id: string,
		@Body() banCustomerDto: BanCustomerDto,
	) {
		await this.customersService.ban(id, banCustomerDto);
		await this.clearCache(id);
		return { success: true };
	}

	@Delete(":id")
	@ApiOperation({ summary: "Soft delete a customer" })
	@ApiOkResponse({ schema: { properties: { success: { type: "boolean" } } } })
	@Permissions("Users_DELETE")
	async softDelete(@Param("id", ParseUUIDPipe) id: string) {
		await this.customersService.softDelete(id);
		await this.clearCache(id);
		return { success: true };
	}

	private async clearCache(userId?: string) {
		if (!userId) return;
		await this.redis.del([`session:${userId}`]);
	}
}
