import {
	CallHandler,
	ExecutionContext,
	Injectable,
	Logger,
	NestInterceptor,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger = new Logger(LoggingInterceptor.name);

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const now = Date.now();
		const request = context.switchToHttp().getRequest();
		const method = request?.method ?? "UNKNOWN";
		const url = request?.url ?? "N/A";

		return next.handle().pipe(
			tap(() => {
				this.logger.verbose(
					`====> [ ${method} ${url} - ${Date.now() - now}ms ]`,
				);
			}),
			catchError((error) => {
				this.logger.error(
					`Request failed [ ${method} ${url} - ${Date.now() - now}ms ]`,
					error instanceof Error ? error.stack : undefined,
				);
				return throwError(() => error);
			}),
		);
	}
}
