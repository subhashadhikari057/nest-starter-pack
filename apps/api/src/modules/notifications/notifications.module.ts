import { EmailClient } from "@bullhouse/email";
import { QueueName } from "@bullhouse/jobs";
import { OtpService } from "@bullhouse/otp";
import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { OtpModule } from "@/services/otp/otp.module";
import { EMAIL_CLIENT } from "./email.constants";
import { EmailNotificationService } from "./email.service";
import { NotificationsService } from "./notification.service";
import { NotificationOrphanReconcilerService } from "./notification-orphan-reconciler.service";
import { NotificationsProcessor } from "./notifications.processor";
import { TransactionalModule } from "./transactional/transactional.module";

@Global()
@Module({
	imports: [
		ConfigModule,
		OtpModule,
		BullModule.registerQueue({ name: QueueName.NOTIFICATIONS }),
		TransactionalModule,
	],
	providers: [
		{
			provide: EMAIL_CLIENT,
			inject: [ConfigService],
			useFactory: (config: ConfigService) => {
				const host = config.get<string>("EMAIL_SMTP_HOST");
				const port = config.get<number>("EMAIL_SMTP_PORT");
				const secureFlag = config.get<string | boolean>("EMAIL_SMTP_SECURE");
				const username = config.get<string>("EMAIL_SMTP_USER");
				const password = config.get<string>("EMAIL_SMTP_PASSWORD");
				const defaultFrom = config.get<string>("EMAIL_DEFAULT_FROM");

				const secure =
					typeof secureFlag === "boolean" ? secureFlag : secureFlag === "true";
				const smtpConfigured = Boolean(host && port);

				return new EmailClient({
					smtp: smtpConfigured
						? {
								host,
								port: Number(port),
								secure,
								auth:
									username && password
										? { user: username, pass: password }
										: undefined,
								from: defaultFrom,
							}
						: null,
					defaultFrom,
				});
			},
		},
		{
			provide: OtpService,
			// nestjs-doctor-ignore architecture/no-manual-instantiation — useFactory is proper DI
			useFactory: () => new OtpService(),
		},
		EmailNotificationService,
		NotificationsProcessor,
		NotificationOrphanReconcilerService,
		NotificationsService,
	],
	exports: [
		EmailNotificationService,
		OtpService,
		NotificationsService,
		TransactionalModule,
	],
})
export class NotificationsModule {}
