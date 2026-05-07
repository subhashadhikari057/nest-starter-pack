import { account, customerSessions, customers } from "@bullhouse/db";
import {
	DeleteUserAccountPayload,
	MaintenanceJob,
	QueueName,
} from "@bullhouse/jobs";
import { InjectQueue } from "@nestjs/bullmq";
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { compare, hash } from "bcrypt";
import { Queue } from "bullmq";
import { and, eq } from "drizzle-orm";
import { DATABASE, type Database } from "@/database/database.module";
import { AUTH_ACTOR_TYPE } from "@/modules/auth/interfaces/auth.interfaces";
import { NotificationsService } from "@/modules/notifications/notification.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import {
	ACCOUNT_DELETION_BAN_REASON_PREFIX,
	ACCOUNT_DELETION_DELAY_DAYS,
	ACCOUNT_DELETION_JOB_ID_PREFIX,
} from "./user.constants";

@Injectable()
export class UserService {
	private readonly logger = new Logger(UserService.name);

	constructor(
		@Inject(DATABASE) private readonly db: Database,
		private readonly notificationService: NotificationsService,
		@InjectQueue(QueueName.MAINTENANCE)
		private readonly maintenanceQueue: Queue,
	) {}

	async updateProfile(userId: string, dto: UpdateProfileDto) {
		const [updatedUser] = await this.db
			.update(customers)
			.set({
				...dto,
				updatedAt: new Date(),
			})
			.where(eq(customers.id, userId))
			.returning({
				id: customers.id,
				name: customers.name,
				email: customers.email,
				image: customers.image,
				phone: customers.phone,
				emailVerified: customers.emailVerified,
				phoneVerified: customers.phoneVerified,
			});

		if (!updatedUser) {
			throw new NotFoundException("User not found");
		}

		return updatedUser;
	}

	async changePassword(userId: string, dto: ChangePasswordDto) {
		const [userAccount] = await this.db
			.select()
			.from(account)
			.where(
				and(
					eq(account.actorType, AUTH_ACTOR_TYPE.CUSTOMER),
					eq(account.customerId, userId),
				),
			)
			.limit(1);

		if (!userAccount || !userAccount.password) {
			throw new BadRequestException(
				"This account does not have a password set (it might be using a social login).",
			);
		}

		const passwordMatches = await compare(
			dto.currentPassword,
			userAccount.password,
		);
		if (!passwordMatches) {
			throw new UnauthorizedException("Incorrect current password.");
		}

		const newPasswordHash = await hash(dto.newPassword, 12);

		await this.db
			.update(account)
			.set({
				password: newPasswordHash,
				updatedAt: new Date(),
			})
			.where(eq(account.id, userAccount.id));

		void this.notificationService
			.sendToUser({
				body: "Your account password was updated. If you didn't make this change, secure your account immediately.",
				title: "Password Updated",
				userId: userId,
				priority: "high",
				type: "personal",
				inAppTargets: ["mobile_in_app", "web_in_app"],
				pushTargets: ["mobile_push"],
			})
			.catch((error) => {
				this.logger.warn(
					`Failed to enqueue password change notification for user ${userId}`,
					error,
				);
			});

		return { success: true, message: "Password changed successfully." };
	}

	async deleteAccount(userId: string) {
		const existingUser = await this.db.query.customers.findFirst({
			columns: {
				id: true,
			},
			where: eq(customers.id, userId),
		});

		if (!existingUser) {
			throw new NotFoundException("User not found");
		}

		const now = new Date();
		const deleteAt = new Date(
			now.getTime() + ACCOUNT_DELETION_DELAY_DAYS * 24 * 60 * 60 * 1000,
		);
		const deleteAtIso = deleteAt.toISOString();
		const banReason = `${ACCOUNT_DELETION_BAN_REASON_PREFIX}${deleteAtIso}`;
		const jobId = `${ACCOUNT_DELETION_JOB_ID_PREFIX}-${userId}`;

		const existingDeletionJob = await this.maintenanceQueue.getJob(jobId);
		if (!existingDeletionJob) {
			const payload: DeleteUserAccountPayload = {
				userId,
				requestedAt: now.toISOString(),
			};

			await this.maintenanceQueue.add(
				MaintenanceJob.DELETE_USER_ACCOUNT,
				payload,
				{
					jobId,
					delay: deleteAt.getTime() - now.getTime(),
					removeOnComplete: true,
					removeOnFail: true,
				},
			);
		}

		await this.db
			.update(customers)
			.set({
				banned: true,
				banReason,
				updatedAt: now,
			})
			.where(eq(customers.id, userId));

		await this.db
			.delete(customerSessions)
			.where(eq(customerSessions.customerId, userId));

		return {
			success: true,
			message: "Account is scheduled for deletion after 7 days.",
			scheduledDeletionAt: deleteAtIso,
		};
	}
}
