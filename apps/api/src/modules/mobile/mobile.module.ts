import { Module } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./user/user.module";

@Module({
	controllers: [],
	providers: [],
	imports: [
		AuthModule,
		UserModule,
		RouterModule.register([
			{
				path: "mobile",
				children: [AuthModule, UserModule],
			},
		]),
	],
})
export class MobileModule {}
