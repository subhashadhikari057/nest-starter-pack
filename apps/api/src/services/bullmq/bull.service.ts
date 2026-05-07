import { Injectable, Logger } from "@nestjs/common";
import { Job, JobsOptions, Queue } from "bullmq";

@Injectable()
export class BullService {
	private readonly logger = new Logger(BullService.name);

	/**
	 * Add a job to a specific queue
	 */
	async addJob<T>(
		queue: Queue,
		name: string,
		data: T,
		opts?: JobsOptions,
	): Promise<Job<T>> {
		try {
			const job = await queue.add(name, data, opts);
			this.logger.debug(
				`Job ${name} added to queue ${queue.name} with ID ${job.id}`,
			);
			return job;
		} catch (error) {
			this.logger.error(
				`Failed to add job ${name} to queue ${queue.name}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Get a job by ID from a specific queue
	 */
	async getJob<T>(queue: Queue, jobId: string): Promise<Job<T> | undefined> {
		try {
			const job = await queue.getJob(jobId);
			if (!job) {
				this.logger.warn(`Job ${jobId} not found in queue ${queue.name}`);
				return undefined;
			}
			return job;
		} catch (error) {
			this.logger.error(
				`Failed to get job ${jobId} from queue ${queue.name}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Get job status
	 */
	async getJobStatus(queue: Queue, jobId: string): Promise<string | undefined> {
		try {
			const job = await this.getJob(queue, jobId);
			if (!job) return undefined;
			return await job.getState();
		} catch (error) {
			this.logger.error(
				`Failed to get status for job ${jobId} in queue ${queue.name}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Remove a job from a queue
	 */
	async removeJob(queue: Queue, jobId: string): Promise<void> {
		try {
			const job = await this.getJob(queue, jobId);
			if (job) {
				await job.remove();
				this.logger.debug(`Job ${jobId} removed from queue ${queue.name}`);
			}
		} catch (error) {
			this.logger.error(
				`Failed to remove job ${jobId} from queue ${queue.name}:`,
				error,
			);
			throw error;
		}
	}
}
