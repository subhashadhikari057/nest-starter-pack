import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { BullBoardModule } from "@bull-board/nestjs";
import { QueueName } from "@bullhouse/jobs";
import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { Global, Logger, Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type JobsOptions, Queue } from "bullmq";
import { BullService } from "./bull.service";

const BULL_DEFAULT_PRIORITY_ENV = "BULL_DEFAULT_PRIORITY";
const BULL_DEFAULT_ATTEMPTS_ENV = "BULL_DEFAULT_ATTEMPTS";
const BULL_DEFAULT_BACKOFF_DELAY_MS_ENV = "BULL_DEFAULT_BACKOFF_DELAY_MS";
const BULL_DEFAULT_REMOVE_ON_COMPLETE_AGE_SEC_ENV =
	"BULL_DEFAULT_REMOVE_ON_COMPLETE_AGE_SEC";
const BULL_DEFAULT_REMOVE_ON_COMPLETE_COUNT_ENV =
	"BULL_DEFAULT_REMOVE_ON_COMPLETE_COUNT";
const BULL_DEFAULT_REMOVE_ON_FAIL_AGE_SEC_ENV =
	"BULL_DEFAULT_REMOVE_ON_FAIL_AGE_SEC";
const BULL_DEFAULT_REMOVE_ON_FAIL_COUNT_ENV =
	"BULL_DEFAULT_REMOVE_ON_FAIL_COUNT";

const REGISTERED_QUEUES: QueueName[] = [
	QueueName.NOTIFICATIONS,
	QueueName.CART,
	QueueName.ORDERS,
	QueueName.ORDERS_MAINTENANCE,
	QueueName.COMMUNICATION,
	QueueName.UPLOAD,
	QueueName.MAINTENANCE,
	QueueName.COURSES,
	QueueName.TRAINING,
	QueueName.VIDEO_TRANSCODE,
	QueueName.TRANSCODE_RESULT,
];

function resolvePositiveInt(
	configService: ConfigService,
	envKey: string,
): number {
	const rawValue = configService.get<string | number>(envKey);
	if (rawValue === undefined || rawValue === null || rawValue === "") {
		throw new Error(`${envKey} is required and must be a positive integer`);
	}

	const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`${envKey} must be a positive integer`);
	}

	return parsed;
}

function resolveNonNegativeInt(
	configService: ConfigService,
	envKey: string,
): number {
	const rawValue = configService.get<string | number>(envKey);
	if (rawValue === undefined || rawValue === null || rawValue === "") {
		throw new Error(`${envKey} is required and must be a non-negative integer`);
	}

	const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(`${envKey} must be a non-negative integer`);
	}

	return parsed;
}

function resolveOptionalPositiveInt(
	configService: ConfigService,
	envKey: string,
): number | undefined {
	const rawValue = configService.get<string | number>(envKey);
	if (rawValue === undefined || rawValue === null || rawValue === "") {
		return undefined;
	}

	const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`${envKey} must be a positive integer`);
	}

	return parsed;
}

function resolveOptionalNonNegativeInt(
	configService: ConfigService,
	envKey: string,
): number | undefined {
	const rawValue = configService.get<string | number>(envKey);
	if (rawValue === undefined || rawValue === null || rawValue === "") {
		return undefined;
	}

	const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(`${envKey} must be a non-negative integer`);
	}

	return parsed;
}

function resolveQueueDefaultJobOptions(
	configService: ConfigService,
	queueName: QueueName,
): JobsOptions {
	const queueEnvSegment = queueName.toUpperCase();
	const defaultPriority = resolveNonNegativeInt(
		configService,
		BULL_DEFAULT_PRIORITY_ENV,
	);
	const defaultAttempts = resolvePositiveInt(
		configService,
		BULL_DEFAULT_ATTEMPTS_ENV,
	);
	const defaultBackoffDelayMs = resolvePositiveInt(
		configService,
		BULL_DEFAULT_BACKOFF_DELAY_MS_ENV,
	);
	const defaultRemoveOnCompleteAge = resolvePositiveInt(
		configService,
		BULL_DEFAULT_REMOVE_ON_COMPLETE_AGE_SEC_ENV,
	);
	const defaultRemoveOnCompleteCount = resolvePositiveInt(
		configService,
		BULL_DEFAULT_REMOVE_ON_COMPLETE_COUNT_ENV,
	);
	const defaultRemoveOnFailAge = resolvePositiveInt(
		configService,
		BULL_DEFAULT_REMOVE_ON_FAIL_AGE_SEC_ENV,
	);
	const defaultRemoveOnFailCount = resolvePositiveInt(
		configService,
		BULL_DEFAULT_REMOVE_ON_FAIL_COUNT_ENV,
	);

	const priority =
		resolveOptionalNonNegativeInt(
			configService,
			`BULL_QUEUE_${queueEnvSegment}_PRIORITY`,
		) ?? defaultPriority;
	const attempts =
		resolveOptionalPositiveInt(
			configService,
			`BULL_QUEUE_${queueEnvSegment}_ATTEMPTS`,
		) ?? defaultAttempts;
	const backoffDelayMs =
		resolveOptionalPositiveInt(
			configService,
			`BULL_QUEUE_${queueEnvSegment}_BACKOFF_DELAY_MS`,
		) ?? defaultBackoffDelayMs;
	const removeOnCompleteAge =
		resolveOptionalPositiveInt(
			configService,
			`BULL_QUEUE_${queueEnvSegment}_REMOVE_ON_COMPLETE_AGE_SEC`,
		) ?? defaultRemoveOnCompleteAge;
	const removeOnCompleteCount =
		resolveOptionalPositiveInt(
			configService,
			`BULL_QUEUE_${queueEnvSegment}_REMOVE_ON_COMPLETE_COUNT`,
		) ?? defaultRemoveOnCompleteCount;
	const removeOnFailAge =
		resolveOptionalPositiveInt(
			configService,
			`BULL_QUEUE_${queueEnvSegment}_REMOVE_ON_FAIL_AGE_SEC`,
		) ?? defaultRemoveOnFailAge;
	const removeOnFailCount =
		resolveOptionalPositiveInt(
			configService,
			`BULL_QUEUE_${queueEnvSegment}_REMOVE_ON_FAIL_COUNT`,
		) ?? defaultRemoveOnFailCount;

	return {
		priority,
		attempts,
		backoff: { type: "exponential", delay: backoffDelayMs },
		removeOnComplete: {
			age: removeOnCompleteAge,
			count: removeOnCompleteCount,
		},
		removeOnFail: {
			age: removeOnFailAge,
			count: removeOnFailCount,
		},
	};
}

/**
 * Provider to configure UPLOAD queue with higher maxListeners
 * Prevents MaxListenersExceededWarning when processing hundreds of images
 */
const uploadQueueProvider = {
	provide: "UPLOAD_QUEUE_CONFIG",
	inject: [getQueueToken(QueueName.UPLOAD)],
	useFactory: (uploadQueue: Queue) => {
		uploadQueue.setMaxListeners(500);
		return uploadQueue;
	},
};

const bullBoardImports = [
	BullBoardModule.forRoot({
		route: "/admin/queues",
		adapter: ExpressAdapter,
	}),
	BullBoardModule.forFeature(
		...REGISTERED_QUEUES.map((name) => ({
			name,
			adapter: BullMQAdapter,
		})),
	),
];

@Global()
@Module({
	imports: [
		BullModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				connection: {
					url: configService.getOrThrow<string>("REDIS_URL"),
					// BullMQ needs a specific family setting for some environments
					family: 0,
				},
				defaultJobOptions: {
					...resolveQueueDefaultJobOptions(configService, QueueName.ORDERS),
				},
			}),
		}),
		...REGISTERED_QUEUES.map((name) =>
			BullModule.registerQueueAsync({
				name,
				inject: [ConfigService],
				useFactory: (configService: ConfigService) => {
					const defaultJobOptions = resolveQueueDefaultJobOptions(
						configService,
						name,
					);

					if (name === QueueName.VIDEO_TRANSCODE) {
						return {
							defaultJobOptions: {
								...defaultJobOptions,
								attempts: 2,
								backoff: { type: "exponential", delay: 5000 },
								removeOnComplete: { age: 6 * 3600, count: 100 },
							},
						};
					}

					return { defaultJobOptions };
				},
			}),
		),
		...bullBoardImports,
	],
	providers: [BullService, uploadQueueProvider],
	exports: [BullModule, BullService],
})
export class JobsModule implements OnApplicationShutdown {
	private readonly logger = new Logger(JobsModule.name);

	// constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

	async onApplicationShutdown() {
		this.logger.debug("[BullModule] Closing Redis connection...");
		// await this.redis.quit();
	}
}
