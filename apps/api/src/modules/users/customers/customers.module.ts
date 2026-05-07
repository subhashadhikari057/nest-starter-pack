import { Module } from "@nestjs/common";
import { RoleGuard } from "@/common/authorization/role.guard";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
	imports: [],
	controllers: [CustomersController],
	providers: [CustomersService, RoleGuard, JwtAuthGuard],
	exports: [CustomersService],
})
export class CustomersModule {}
