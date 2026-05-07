import type { INestApplication } from "@nestjs/common";

import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { NotificationModule } from "@/modules/notification/notification.module";
import { MobileModule } from "../../modules/mobile/mobile.module";
import { filterSwaggerPaths, mountScalarDocsWithJson } from "./swagger.shared";

export const configureMobileSwagger = (app: INestApplication): void => {
	const baseUrl =
		process.env.API_PUBLIC_BASE_URL ||
		`http://localhost:${process.env.PORT || 3003}`;
	const mobileConfig = new DocumentBuilder()
		.setTitle("Bullhouse Mobile API")
		.setDescription("Mobile specific endpoints.")
		.setVersion("1.0")
		.addServer(baseUrl)
		.addBearerAuth()
		.build();

	const mobileModules = Reflect.getMetadata("imports", MobileModule) || [];
	const nestedModules = mobileModules.flatMap((m: any) =>
		typeof m === "function" ? Reflect.getMetadata("imports", m) || [] : [],
	);

	const mobileDocument = SwaggerModule.createDocument(app, mobileConfig, {
		include: [
			NotificationModule,
			MobileModule,
			...mobileModules,
			...nestedModules,
		],
	});

	filterSwaggerPaths(
		mobileDocument,
		(path) =>
			path.startsWith("/api/mobile") ||
			path.startsWith("/mobile") ||
			/^\/api\/v\d+\/mobile/.test(path),
	);

	mountScalarDocsWithJson(app, {
		docsPath: "/api/mobile-docs",
		jsonPath: "/api/mobile-docs/openapi.json",
		document: mobileDocument,
		pageTitle: "Bullhouse Mobile API",
		theme: "deepSpace",
		disableJsonPath: true,
	});
};
