import { Module } from "@nestjs/common";
import { DatabaseModule } from "@/database/database.module";
import { RolePermissionsController } from "./role-permissions.controller";
import { RolePermissionsService } from "./role-permissions.service";

@Module({
	imports: [DatabaseModule],
	controllers: [RolePermissionsController],
	providers: [RolePermissionsService],
})
export class RolePermissionsModule {}
