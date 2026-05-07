import {
	Body,
	Controller,
	Delete,
	Patch,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiResponseDto, ResponseDto } from "@/common/dto/response-dto";
import { AuthUser } from "@/modules/auth/auth.service";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";
import { ProfileUserDto } from "@/modules/auth/dto/public-user.dto";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UserService } from "./user.service";

@ApiTags("User")
@Controller("user")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Patch("profile")
	@ApiOperation({ summary: "Update current user profile" })
	@ApiResponseDto(ProfileUserDto)
	async updateProfile(
		@CurrentUser() user: AuthUser,
		@Body() dto: UpdateProfileDto,
	) {
		const result = await this.userService.updateProfile(user.id, dto);
		return new ResponseDto("Profile updated.", result);
	}

	@Post("change-password")
	@ApiOperation({ summary: "Change current user password" })
	async changePassword(
		@CurrentUser() user: AuthUser,
		@Body() dto: ChangePasswordDto,
	) {
		const result = await this.userService.changePassword(user.id, dto);
		return new ResponseDto("Password changed successfully.", result);
	}

	@Delete("delete-account")
	@ApiOperation({ summary: "Delete current user account" })
	async deleteAccount(@CurrentUser() user: AuthUser) {
		const result = await this.userService.deleteAccount(user.id);
		return new ResponseDto("Account deletion scheduled.", result);
	}
}
