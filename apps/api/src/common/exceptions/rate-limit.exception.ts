import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCodes } from "@/common/types/error-codes";

export class RateLimitExceededException extends HttpException {
	constructor() {
		super(
			{
				message: "Too many requests. Please try again later.",
				errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
			},
			HttpStatus.TOO_MANY_REQUESTS,
		);
	}
}
