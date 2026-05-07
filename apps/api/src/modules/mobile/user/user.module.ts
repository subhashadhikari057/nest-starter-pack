import { Module } from "@nestjs/common";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { DeleteUserAccountProcessor } from "./delete-user-account.processor";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
	imports: [NotificationsModule],
	controllers: [UserController],
	providers: [UserService, DeleteUserAccountProcessor],
})
export class UserModule {}
