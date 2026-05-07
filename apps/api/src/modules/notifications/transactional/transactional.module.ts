import { Module } from "@nestjs/common";
import { NotificationsService } from "../notification.service";
import { NotificationRecipientResolverService } from "./notification-recipient-resolver.service";
import { NotificationRouterService } from "./notification-router.service";
import { TransactionalNotificationCatalog } from "./transactional-notification.catalog";

@Module({
	providers: [
		NotificationsService,
		TransactionalNotificationCatalog,
		NotificationRecipientResolverService,
		NotificationRouterService,
	],
	exports: [
		TransactionalNotificationCatalog,
		NotificationRecipientResolverService,
		NotificationRouterService,
	],
})
export class TransactionalModule {}
