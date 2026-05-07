import {
	BadRequestException,
	CallHandler,
	ConflictException,
	ExecutionContext,
	HttpStatus,
	Injectable,
	type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
	catchError,
	from,
	map,
	mergeMap,
	type Observable,
	of,
	throwError,
} from "rxjs";
import {
	IDEMPOTENCY_METADATA_KEY,
	type IdempotencyMetadata,
} from "./idempotency.decorator";
import { IdempotencyService } from "./idempotency.service";
import { RequestHashUtil } from "./request-hash.util";

interface IdempotencyHttpRequest {
	method: string;
	originalUrl?: string;
	url?: string;
	body?: unknown;
	query?: unknown;
	params?: Record<string, string | number>;
	headers: Record<string, string | string[] | undefined>;
	user?: {
		id?: string;
	};
}

interface IdempotencyHttpResponse {
	statusCode?: number;
	status?: (code: number) => void;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
	constructor(
		private readonly reflector: Reflector,
		private readonly idempotencyService: IdempotencyService,
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const metadata = this.reflector.getAllAndOverride<IdempotencyMetadata>(
			IDEMPOTENCY_METADATA_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (!metadata) {
			return next.handle();
		}

		const http = context.switchToHttp();
		const request = http.getRequest<IdempotencyHttpRequest>();
		const response = http.getResponse<IdempotencyHttpResponse>();

		const idempotencyKey = this.readIdempotencyKey(
			request.headers?.["idempotency-key"],
		);

		if (!idempotencyKey) {
			if (metadata.required === false) {
				return next.handle();
			}
			throw new BadRequestException("Idempotency-Key header is required.");
		}

		const actorId = request.user?.id ? String(request.user.id) : "anonymous";
		const scopeKey = this.resolveScopeKey(metadata.scope, request.params);
		const requestHash = RequestHashUtil.fromRequest({
			method: request.method,
			path: request.originalUrl ?? request.url ?? metadata.scope,
			query: request.query,
			body: request.body,
		});

		return from(
			this.idempotencyService.begin({
				actorId,
				idempotencyKey,
				scopeKey,
				requestHash,
			}),
		).pipe(
			mergeMap((beginResult) => {
				if (beginResult.kind === "CONFLICT") {
					throw new ConflictException(
						"Idempotency key has already been used with a different payload.",
					);
				}

				if (beginResult.kind === "PENDING") {
					throw new ConflictException(
						"A matching idempotent request is still in progress.",
					);
				}

				if (beginResult.kind === "REPLAY") {
					const statusCode = beginResult.statusCode ?? HttpStatus.OK;
					response.status?.(statusCode);
					return of(beginResult.responseJson ?? null);
				}

				return next.handle().pipe(
					mergeMap((responseJson) =>
						from(
							this.idempotencyService.commitSuccess({
								actorId,
								idempotencyKey,
								scopeKey,
								requestHash,
								statusCode: response.statusCode ?? HttpStatus.CREATED,
								responseJson,
							}),
						).pipe(map(() => responseJson)),
					),
					catchError((error) =>
						from(
							this.idempotencyService
								.commitFailure({
									actorId,
									idempotencyKey,
									scopeKey,
									requestHash,
								})
								.catch(() => undefined),
						).pipe(mergeMap(() => throwError(() => error))),
					),
				);
			}),
		);
	}

	private readIdempotencyKey(
		headerValue: string | string[] | undefined,
	): string | null {
		if (Array.isArray(headerValue)) {
			return headerValue[0] ?? null;
		}

		if (typeof headerValue === "string") {
			const value = headerValue.trim();
			return value.length > 0 ? value : null;
		}

		return null;
	}

	private resolveScopeKey(
		scopeTemplate: string,
		params: Record<string, string | number> | undefined,
	): string {
		if (!params) {
			return scopeTemplate;
		}

		return Object.entries(params).reduce((scope, [key, value]) => {
			return scope.replaceAll(`:${key}`, String(value));
		}, scopeTemplate);
	}
}
