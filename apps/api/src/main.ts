import {
	ClassSerializerInterceptor,
	Logger,
	LogLevel,
	ValidationPipe,
	VersioningType,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { warnProductionLogCalls } from "./common/utils/production-log-check";
import {
	configureSwagger,
	type SwaggerBootMode,
	shouldConfigureSwagger,
} from "./config/swagger.config";

let app: NestExpressApplication;
const logger = new Logger("Bootstrap");

const logLevels: LogLevel[] =
	process.env.NODE_ENV === "production"
		? ["log", "warn", "error", "fatal"]
		: ["log", "warn", "error", "fatal", "debug", "verbose"];

async function bootstrap() {
	app = await NestFactory.create<NestExpressApplication>(AppModule, {
		rawBody: true,
		logger: logLevels,
	});
	app.useWebSocketAdapter(new IoAdapter(app));
	const configService = app.get(ConfigService);

	app.set("trust proxy", 1);

	const swaggerEnabled = configService.get<boolean>("SWAGGER_ENABLED") ?? true;
	app.use(
		helmet({
			contentSecurityPolicy: {
				directives: {
					...helmet.contentSecurityPolicy.getDefaultDirectives(),
					// Relax script-src only when Swagger docs are active (Scalar loads from CDN)
					...(swaggerEnabled && {
						"script-src": [
							"'self'",
							"https://cdn.jsdelivr.net",
							"'unsafe-inline'",
						],
					}),
				},
			},
		}),
	);

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);

	app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

	const corsOrigins = configService.get<string>("CORS_ORIGINS");
	const isProduction = configService.get<string>("NODE_ENV") === "production";
	const corsOrigin = corsOrigins
		? corsOrigins.split(",").map((origin) => origin.trim())
		: isProduction
			? []
			: ["http://localhost:3000"];

	app.enableCors({
		origin: corsOrigin,
	});

	app.setGlobalPrefix("api");
	app.enableVersioning({ type: VersioningType.URI });

	const swaggerBootMode =
		configService.get<SwaggerBootMode>("SWAGGER_BOOT_MODE") ?? "eager";
	let swaggerConfigured = false;

	if (
		shouldConfigureSwagger({ enabled: swaggerEnabled, mode: swaggerBootMode })
	) {
		try {
			configureSwagger(app);
			swaggerConfigured = true;
		} catch (error) {
			logger.error(
				"Swagger boot failed. Continuing without docs to keep API startup healthy.",
				error instanceof Error ? error.stack : String(error),
			);
		}
	}

	app.enableShutdownHooks();

	const port = process.env.PORT ?? 5000;
	await app.listen(port, "0.0.0.0");

	logger.log(
		`🚀 Server running on http://localhost:${port} (swagger=${swaggerConfigured ? "enabled" : "disabled"})`,
	);

	if (process.env.NODE_ENV === "production") {
		warnProductionLogCalls(__dirname, logger);
	}
}

bootstrap();
