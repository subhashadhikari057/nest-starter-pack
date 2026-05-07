import { join } from "node:path";

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
	APP_FILTER,
	APP_GUARD,
	APP_INTERCEPTOR,
	HttpAdapterHost,
} from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ServeStaticModule } from "@nestjs/serve-static";
import { HealthController } from "./common/controllers/health.controller";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { validateEnv } from "./config/env.validation";
import { DatabaseModule } from "./database/database.module";
import { MongoDBModule } from "./database/mongodb.module";
import { AuthModule } from "./modules/auth/auth.module";
import { JwtAuthGuard } from "./modules/auth/guards/jwt-auth.guard";
import { MobileModule } from "./modules/mobile/mobile.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { RoleModule } from "./modules/role/role.module";
import { RolePermissionsModule } from "./modules/role-permissions/role-permissions.module";
import { UsersModule } from "./modules/users/users.module";
import { ActivityModule } from "./services/activity/activity.module";
import { JobsModule } from "./services/bullmq/bull.module";
import { FirebaseModule } from "./services/firebase/firebase.module";
import { RealtimeModule } from "./services/realtime/realtime.module";
import { RedisModule } from "./services/redis/redis.module";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ".env",
			validate: validateEnv,
		}),
		ServeStaticModule.forRoot({
			serveRoot: "/uploads",
			rootPath: join(process.cwd(), "uploads"),
			serveStaticOptions: {
				index: false,
			},
		}),
		ServeStaticModule.forRoot({
			serveRoot: "/assets",
			rootPath: join(process.cwd(), "assets"),
			serveStaticOptions: {
				index: false,
			},
		}),
		EventEmitterModule.forRoot(),
		ScheduleModule.forRoot(),
		RedisModule,
		JobsModule,
		FirebaseModule,
		RealtimeModule.register(),
		DatabaseModule,
		MongoDBModule,
		AuthModule,
		UsersModule,
		RoleModule,
		PermissionsModule,
		RolePermissionsModule,
		NotificationModule,
		ActivityModule,
		MobileModule,
	],
	controllers: [HealthController],
	providers: [
		{
			provide: APP_GUARD,
			useClass: JwtAuthGuard,
		},
		{
			provide: APP_FILTER,
			useFactory: (httpAdapterHost: HttpAdapterHost) =>
				new AllExceptionsFilter(httpAdapterHost),
			inject: [HttpAdapterHost],
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: LoggingInterceptor,
		},
	],
})
export class AppModule {}
