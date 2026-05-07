import type { Request } from "express";

import {
	ArgumentsHost,
	BadRequestException,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { ZodError } from "zod";

type ExceptionResponse = {
	statusCode: number;
	errorCode: string | null;
	message: string;
	timestamp?: string;
	path?: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

	catch(exception: unknown, host: ArgumentsHost) {
		const { httpAdapter } = this.httpAdapterHost;
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = this.buildResponse(exception, request);

		const cause =
			exception instanceof Error
				? ((exception as Error & { cause?: unknown }).cause ?? null)
				: null;

		this.logger.error(
			cause instanceof Error
				? `${response.message} \n 🚀 cause: ${cause.message}`
				: response.message,
			exception instanceof Error ? exception.stack : undefined,
			`${request.method} ${request.url}`,
		);

		httpAdapter.reply(ctx.getResponse(), response, response.statusCode);
	}

	private buildResponse(
		exception: unknown,
		request: Request,
	): ExceptionResponse {
		const statusCode =
			exception instanceof HttpException
				? exception.getStatus()
				: exception instanceof ZodError
					? HttpStatus.BAD_REQUEST
					: HttpStatus.INTERNAL_SERVER_ERROR;

		const { message, errorCode } = this.buildMessage(exception);
		const isProduction = process.env.NODE_ENV === "production";

		return {
			statusCode,
			errorCode,
			message,
			...(!isProduction && {
				timestamp: new Date().toISOString(),
				path: this.httpAdapterHost.httpAdapter.getRequestUrl(request),
			}),
		};
	}

	private buildMessage(exception: unknown): {
		message: string;
		errorCode: string | null;
	} {
		if (exception instanceof ZodError) {
			return {
				message: exception.issues.map((issue) => issue.message).join(", "),
				errorCode: null,
			};
		}

		if (exception instanceof BadRequestException) {
			const response = exception.getResponse() as
				| string
				| {
						message?: string | string[];
						errorCode?: string;
				  };

			if (typeof response === "string") {
				return { message: response, errorCode: null };
			}

			return {
				message: this.extractMessage(response?.message),
				errorCode: response?.errorCode ?? null,
			};
		}

		if (exception instanceof HttpException) {
			const response = exception.getResponse() as
				| string
				| {
						message?: string | string[];
						errorCode?: string;
				  };

			if (typeof response === "string") {
				return { message: response, errorCode: null };
			}

			return {
				message: this.extractMessage(response?.message) || exception.message,
				errorCode: response?.errorCode ?? null,
			};
		}

		if (exception instanceof Error) {
			const errorWithCode = exception as Error & { errorCode?: string };
			return {
				message: exception.message,
				errorCode: errorWithCode.errorCode ?? null,
			};
		}

		return {
			message: "Something went wrong",
			errorCode: null,
		};
	}

	private extractMessage(message?: string | string[]): string {
		if (Array.isArray(message)) {
			return message.join(", ");
		}
		return message ?? "";
	}
}
