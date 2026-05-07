import { Global, Module } from "@nestjs/common";
import { DatabaseModule } from "@/database/database.module";
import { RoleController } from "./role.controller";
import { RoleService } from "./role.service";

@Global()
@Module({
	imports: [DatabaseModule],
	controllers: [RoleController],
	providers: [RoleService],
	exports: [RoleService],
})
export class RoleModule {}
